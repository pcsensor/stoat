import ExpoModulesCore
import CallKit
import AVFoundation
import AudioToolbox

public class MicForegroundModule: Module {
  private let manager = CallKitManager()

  public func definition() -> ModuleDefinition {
    Name("MicForeground")

    Events("onCallEnded", "onCallMuted", "onAudioSessionActivated", "onAudioSessionDeactivated", "onAudioInterrupted")

    OnCreate {
      self.manager.module = self
      self.manager.setupCallKit()
    }

    Function("start") { (channelName: String) -> Bool in
      return self.manager.startCall(channelName: channelName)
    }

    Function("stop") { () -> Bool in
      return self.manager.endCall()
    }

    Function("setMuted") { (muted: Bool) -> Bool in
      return self.manager.setMuted(muted: muted)
    }

    Function("isBatteryOptimizationIgnored") { () -> Bool in
      return true
    }

    Function("requestIgnoreBatteryOptimization") { () -> Bool in
      return false
    }

    Function("playTone") { (type: String) -> Bool in
      if type == "join" {
        AudioServicesPlaySystemSound(1057)
      } else {
        AudioServicesPlaySystemSound(1054)
      }
      return true
    }
  }

  func notifyCallEnded() {
    sendEvent("onCallEnded", [:])
  }

  func notifyCallMuted(muted: Bool) {
    sendEvent("onCallMuted", ["muted": muted])
  }

  func notifyAudioSessionActivated() {
    sendEvent("onAudioSessionActivated", [:])
  }

  func notifyAudioSessionDeactivated() {
    sendEvent("onAudioSessionDeactivated", [:])
  }

  func notifyAudioInterrupted(phase: String, shouldResume: Bool) {
    sendEvent("onAudioInterrupted", ["phase": phase, "shouldResume": shouldResume])
  }
}

class CallKitManager: NSObject, CXProviderDelegate {
  weak var module: MicForegroundModule?
  private var provider: CXProvider?
  private var callController = CXCallController()
  private var currentCallUUID: UUID?
  private var isCallActive = false
  private var audioInterruptionObserver: NSObjectProtocol?

  func setupCallKit() {
    let config = CXProviderConfiguration(localizedName: "Radio")
    config.supportsVideo = false
    config.maximumCallGroups = 1
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.generic]
    if #available(iOS 14.0, *) {
      config.includesCallsInRecents = false
    }

    provider = CXProvider(configuration: config)
    provider?.setDelegate(self, queue: DispatchQueue.main)

    audioInterruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      self?.handleAudioInterruption(notification)
    }
  }

  deinit {
    if let observer = audioInterruptionObserver {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  func startCall(channelName: String) -> Bool {
    let uuid = UUID()
    self.currentCallUUID = uuid
    self.isCallActive = true

    let handle = CXHandle(type: .generic, value: channelName)
    let startAction = CXStartCallAction(call: uuid, handle: handle)
    startAction.isVideo = false

    let transaction = CXTransaction(action: startAction)
    callController.request(transaction) { [weak self] error in
      guard let self = self else { return }
      if let error = error {
        print("[Radio CallKit] startCall error: \(error.localizedDescription)")
        self.provider?.reportOutgoingCall(with: uuid, connectedAt: Date())
      } else {
        let update = CXCallUpdate()
        update.remoteHandle = handle
        update.localizedCallerName = "Radio · \(channelName)"
        update.hasVideo = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsHolding = false
        update.supportsDTMF = false
        self.provider?.reportCall(with: uuid, updated: update)
        self.provider?.reportOutgoingCall(with: uuid, connectedAt: Date())
      }
    }

    return true
  }

  func endCall() -> Bool {
    guard let uuid = currentCallUUID, isCallActive else { return true }
    isCallActive = false
    currentCallUUID = nil

    let endAction = CXEndCallAction(call: uuid)
    let transaction = CXTransaction(action: endAction)
    callController.request(transaction) { [weak self] error in
      if error != nil {
        self?.provider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
      }
    }

    return true
  }

  func setMuted(muted: Bool) -> Bool {
    guard let uuid = currentCallUUID, isCallActive else { return false }
    let muteAction = CXSetMutedCallAction(call: uuid, muted: muted)
    let transaction = CXTransaction(action: muteAction)
    callController.request(transaction) { _ in }
    return true
  }

  private func handleAudioInterruption(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let rawType = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: rawType) else {
      return
    }

    if type == .began {
      module?.notifyAudioInterrupted(phase: "began", shouldResume: false)
      return
    }

    let rawOptions = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
    let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
    module?.notifyAudioInterrupted(
      phase: "ended",
      shouldResume: options.contains(.shouldResume)
    )
  }

  // MARK: - CXProviderDelegate

  func providerDidReset(_ provider: CXProvider) {
    let wasActive = isCallActive
    isCallActive = false
    currentCallUUID = nil
    if wasActive {
      module?.notifyCallEnded()
    }
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    provider.reportOutgoingCall(with: action.callUUID, connectedAt: Date())
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    isCallActive = false
    currentCallUUID = nil
    action.fulfill()

    module?.notifyCallEnded()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    action.fulfill()
    module?.notifyCallMuted(muted: action.isMuted)
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    module?.notifyAudioSessionActivated()
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    module?.notifyAudioSessionDeactivated()
  }
}

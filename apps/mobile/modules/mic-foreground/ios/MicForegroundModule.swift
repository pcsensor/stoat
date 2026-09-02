import ExpoModulesCore
import CallKit
import AVFoundation

public class MicForegroundModule: Module {
  private let manager = CallKitManager()

  public func definition() -> ModuleDefinition {
    Name("MicForeground")

    Events("onCallEnded", "onCallMuted")

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
  }

  func notifyCallEnded() {
    sendEvent("onCallEnded", [:])
  }

  func notifyCallMuted(muted: Bool) {
    sendEvent("onCallMuted", ["muted": muted])
  }
}

class CallKitManager: NSObject, CXProviderDelegate {
  weak var module: MicForegroundModule?
  private var provider: CXProvider?
  private var callController = CXCallController()
  private var currentCallUUID: UUID?
  private var isCallActive = false

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
  }

  func startCall(channelName: String) -> Bool {
    let uuid = UUID()
    self.currentCallUUID = uuid
    self.isCallActive = true

    configureAudioSession()

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

    resetAudioSession()
    return true
  }

  func setMuted(muted: Bool) -> Bool {
    guard let uuid = currentCallUUID, isCallActive else { return false }
    let muteAction = CXSetMutedCallAction(call: uuid, muted: muted)
    let transaction = CXTransaction(action: muteAction)
    callController.request(transaction) { _ in }
    return true
  }

  private func configureAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker])
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      print("[Radio CallKit] configureAudioSession error: \(error.localizedDescription)")
    }
  }

  private func resetAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setActive(false, options: .notifyOthersOnDeactivation)
    } catch {
      print("[Radio CallKit] resetAudioSession error: \(error.localizedDescription)")
    }
  }

  // MARK: - CXProviderDelegate

  func providerDidReset(_ provider: CXProvider) {
    isCallActive = false
    currentCallUUID = nil
    resetAudioSession()
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    configureAudioSession()
    provider.reportOutgoingCall(with: action.callUUID, connectedAt: Date())
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    isCallActive = false
    currentCallUUID = nil
    resetAudioSession()
    action.fulfill()

    module?.notifyCallEnded()

    if let url = URL(string: "radio://voice/stop") {
      DispatchQueue.main.async {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
      }
    }
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    action.fulfill()
    module?.notifyCallMuted(muted: action.isMuted)
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
  }
}

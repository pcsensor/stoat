require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'mic-foreground'
  s.version        = package['version']
  s.summary        = 'Radio voice foreground service and CallKit provider'
  s.description    = 'Provides background audio and CallKit system call integration for Radio'
  s.license        = 'MIT'
  s.author         = 'Radio'
  s.homepage       = 'https://example.invalid/radio'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.4'
  s.source         = { :git => 'https://example.invalid/radio.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'CallKit', 'AVFoundation'

  s.source_files = "ios/**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

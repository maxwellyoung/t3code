Pod::Spec.new do |s|
  s.name           = 'T3WatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'Watch Connectivity bridge for the T3 Code Apple Watch app.'
  s.description    = 'Relays agent status to the watch app and watch commands back to the JS runtime.'
  s.author         = 'T3 Tools'
  s.homepage       = 'https://t3tools.com'
  s.platforms      = {
    :ios => '18.0',
  }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end

Pod::Spec.new do |s|
  s.name = 'TrackingMap'
  s.version = '1.0.0'
  s.summary = 'tracking.so native route map'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'tracking.so'
  s.homepage = 'https://tracking.so'
  s.platform = :ios, '17.0'
  s.source = { :path => '.' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.frameworks = 'MapKit'
  s.dependency 'ExpoModulesCore'
end

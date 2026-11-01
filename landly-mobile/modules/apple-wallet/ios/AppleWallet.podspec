Pod::Spec.new do |s|
  s.name           = 'AppleWallet'
  s.version        = '1.0.0'
  s.summary        = "Landly's Add to Apple Wallet button and pass sheet"
  s.description    = 'Wraps PassKit: PKAddPassButton and PKAddPassesViewController.'
  s.author         = 'Landly'
  s.homepage       = 'https://www.golandly.com'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PassKit'
  s.source_files   = '**/*.swift'
end

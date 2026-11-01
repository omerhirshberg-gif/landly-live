import ExpoModulesCore
import PassKit

// The system's Add to Apple Wallet button, filling the frame React Native gives it.
final class AppleWalletButtonView: ExpoView {
  let onAddPress = EventDispatcher()
  private let button = PKAddPassButton(addPassButtonStyle: .black)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    addSubview(button)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  @objc private func pressed() {
    onAddPress()
  }
}

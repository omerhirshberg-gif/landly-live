import ExpoModulesCore
import PassKit

// PassKit for the voucher screen: Apple asks apps for PKAddPassButton, not the
// web badge, and the system draws it in the device's language. addPass fetches
// the short-lived .pkpass URL (app/api/wallet/apple) and shows Wallet's own
// sheet, which is what actually adds the pass.
public final class AppleWalletModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleWallet")

    Function("canAddPasses") { () -> Bool in
      PKAddPassesViewController.canAddPasses()
    }

    AsyncFunction("addPass") { (url: URL, promise: Promise) in
      URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
        guard error == nil, let data, (response as? HTTPURLResponse)?.statusCode == 200 else {
          promise.reject("ERR_PASS_DOWNLOAD", "The pass couldn't be downloaded.")
          return
        }
        let pass: PKPass
        do {
          pass = try PKPass(data: data)
        } catch {
          promise.reject("ERR_PASS_INVALID", "The pass isn't valid.")
          return
        }
        DispatchQueue.main.async {
          guard
            let sheet = PKAddPassesViewController(pass: pass),
            let presenter = self?.appContext?.utilities?.currentViewController()
          else {
            promise.reject("ERR_PASS_SHEET", "Wallet's sheet couldn't open.")
            return
          }
          presenter.present(sheet, animated: true) { promise.resolve(nil) }
        }
      }.resume()
    }

    View(AppleWalletButtonView.self) {
      Events("onAddPress")
    }
  }
}

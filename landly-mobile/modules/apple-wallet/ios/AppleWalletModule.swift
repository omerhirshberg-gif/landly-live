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
        // Codes and numbers only: the URL holds the ticket, and these reach the JS log.
        if let error {
          promise.reject("ERR_PASS_NETWORK", "The pass couldn't be downloaded (URL error \((error as NSError).code)).")
          return
        }
        guard let data, let status = (response as? HTTPURLResponse)?.statusCode, status == 200 else {
          let status = (response as? HTTPURLResponse)?.statusCode ?? 0
          promise.reject("ERR_PASS_HTTP", "The server answered \(status).")
          return
        }
        let pass: PKPass
        do {
          pass = try PKPass(data: data)
        } catch {
          promise.reject("ERR_PASS_INVALID", "PassKit refused the pass (error \((error as NSError).code)).")
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

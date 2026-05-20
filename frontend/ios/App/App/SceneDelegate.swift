import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else {
            return
        }

        let window = UIWindow(windowScene: windowScene)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        window.rootViewController = storyboard.instantiateInitialViewController()
        window.backgroundColor = UIColor(red: 0.862745098, green: 0.9019607843, blue: 0.9568627451, alpha: 1)
        self.window = window
        window.makeKeyAndVisible()
    }
}

import XCTest

final class NativeAuditUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.erpm.medical.lms")

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    func testAuthScreensAndKeyboard() throws {
        app.launch()
        XCTAssertTrue(waitForText("Welcome back", timeout: 12), "Login heading did not appear")
        attachScreenshot("01-login-closed")
        print("[NativeAudit] login launched")
        print(app.debugDescription)

        let emailField = app.textFields["Email address"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field was not accessible")
        emailField.tap()
        XCTAssertTrue(waitForKeyboardVisible("login-email", timeout: 6), "Keyboard did not appear after tapping email field")
        pauseForPaint()
        attachScreenshot("02-login-email-keyboard")
        print("[NativeAudit] email keyboard visible")

        app.typeText("native.audit@example.com")
        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field was not accessible")
        passwordField.tap()
        XCTAssertTrue(waitForKeyboardVisible("login-password", timeout: 5), "Keyboard disappeared before password field check")
        pauseForPaint()
        attachScreenshot("03-login-password-keyboard")
        print("[NativeAudit] password keyboard visible")

        app.terminate()
        app.launch()
        XCTAssertTrue(waitForText("Welcome back", timeout: 8), "Login heading did not appear after relaunch")

        let createAccountLink = app.links["Create your account"]
        XCTAssertTrue(createAccountLink.waitForExistence(timeout: 5), "Create-account link was not accessible")
        createAccountLink.tap()
        XCTAssertTrue(waitForEitherText(["Create profile", "Create Profile"], timeout: 8), "Register screen did not appear after tapping create-account link")
        XCTAssertTrue(app.textFields["Full name"].waitForExistence(timeout: 5), "Register full-name field did not appear before closed screenshot")
        pauseForPaint()
        attachScreenshot("04-register-closed")
        print("[NativeAudit] register launched")

        let fullNameField = app.textFields["Full name"]
        XCTAssertTrue(fullNameField.waitForExistence(timeout: 5), "Register full-name field was not accessible")
        fullNameField.tap()
        XCTAssertTrue(waitForKeyboardVisible("register-full-name", timeout: 6), "Keyboard did not appear after tapping register full-name field")
        pauseForPaint()
        attachScreenshot("05-register-name-keyboard")
        print("[NativeAudit] register keyboard visible")
    }

    func testRegistrationSubmitResult() throws {
        let timestamp = Int(Date().timeIntervalSince1970)
        let email = "native.audit.\(timestamp)@example.com"
        let password = "NativeAudit123"

        app.launch()
        XCTAssertTrue(waitForText("Welcome back", timeout: 12), "Login heading did not appear")
        openRegisterScreen()

        let fullNameField = app.textFields["Full name"]
        XCTAssertTrue(fullNameField.waitForExistence(timeout: 5), "Register full-name field was not accessible")
        fullNameField.tap()
        fullNameField.typeText("Native Audit User")

        let emailField = app.textFields["Email address"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Register email field was not accessible")
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Register password field was not accessible")
        passwordField.tap()
        passwordField.typeText(password)

        let confirmPasswordField = app.secureTextFields["Confirm password"]
        XCTAssertTrue(confirmPasswordField.waitForExistence(timeout: 5), "Register confirm-password field was not accessible")
        confirmPasswordField.tap()
        confirmPasswordField.typeText(password)
        dismissKeyboard()

        let createProfileButton = app.buttons["Create Profile"]
        XCTAssertTrue(createProfileButton.waitForExistence(timeout: 5), "Create Profile button was not accessible")
        if !createProfileButton.isHittable {
            app.swipeUp()
            RunLoop.current.run(until: Date().addingTimeInterval(0.4))
        }
        XCTAssertTrue(createProfileButton.isHittable, "Create Profile button was not reachable after closing keyboard")
        createProfileButton.tap()

        let reachedApp = waitForEitherText(["Study Hub", "Daily Focus", "Dashboard needs a refresh"], timeout: 12)
        let blockedByError = waitForAnyLikelyError(timeout: reachedApp ? 0.2 : 3)
        pauseForPaint()
        attachScreenshot("06-register-submit-result")
        print("[NativeAudit] registration submitted with email: \(email)")
        print("[NativeAudit] registration reached app: \(reachedApp), blocked by error: \(blockedByError)")
        XCTAssertTrue(reachedApp || blockedByError, "Registration submit produced neither dashboard nor visible error state")
    }

    private func waitForText(_ text: String, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "label == %@", text)
        return app.staticTexts.containing(predicate).element.waitForExistence(timeout: timeout)
            || app.buttons.containing(predicate).element.waitForExistence(timeout: 0.5)
            || app.otherElements.containing(predicate).element.waitForExistence(timeout: 0.5)
    }

    private func waitForEitherText(_ texts: [String], timeout: TimeInterval) -> Bool {
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if texts.contains(where: { waitForText($0, timeout: 0.2) }) {
                return true
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        return false
    }

    private func openRegisterScreen() {
        let createAccountLink = app.links["Create your account"]
        XCTAssertTrue(createAccountLink.waitForExistence(timeout: 5), "Create-account link was not accessible")
        createAccountLink.tap()
        XCTAssertTrue(waitForEitherText(["Create profile", "Create Profile"], timeout: 8), "Register screen did not appear after tapping create-account link")
    }

    private func waitForAnyLikelyError(timeout: TimeInterval) -> Bool {
        let patterns = [
            "Unable",
            "Cannot reach",
            "already",
            "Network",
            "server",
            "session token",
            "error",
        ]
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if patterns.contains(where: { pattern in
                let predicate = NSPredicate(format: "label CONTAINS[c] %@", pattern)
                return app.staticTexts.containing(predicate).element.exists
                    || app.otherElements.containing(predicate).element.exists
            }) {
                return true
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        return false
    }

    private func waitForKeyboardVisible(_ label: String, timeout: TimeInterval) -> Bool {
        let keyboard = app.keyboards.element
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if keyboard.exists {
                let frame = keyboard.frame
                print("[NativeAudit] \(label) keyboard frame: \(frame)")
                if frame.width > 100 && frame.height > 120 {
                    return true
                }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        if keyboard.exists {
            print("[NativeAudit] \(label) final keyboard frame: \(keyboard.frame)")
        } else {
            print("[NativeAudit] \(label) keyboard did not exist")
        }
        return false
    }

    private func pauseForPaint() {
        RunLoop.current.run(until: Date().addingTimeInterval(0.45))
    }

    private func dismissKeyboard() {
        let keyboard = app.keyboards.element
        guard keyboard.exists else { return }
        let possibleReturnKeys = ["return", "Return", "Done", "Go"]
        if let key = possibleReturnKeys
            .map({ app.keyboards.buttons[$0] })
            .first(where: { $0.exists && $0.isHittable }) {
            key.tap()
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        if keyboard.exists {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.18)).tap()
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        if keyboard.exists {
            app.swipeDown()
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

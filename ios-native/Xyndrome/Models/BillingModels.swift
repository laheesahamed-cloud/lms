import Foundation

struct SubscriptionResponse: Decodable {
    let currentSubscription: Subscription?
    let history: [Subscription]
    let availablePlans: [SubscriptionPlan]
    let requests: [SubscriptionRequest]
    let payment: BillingPaymentSettings?

    private let legacySubscription: Subscription?
    private let legacyPlan: SubscriptionPlan?
    private let legacyExpiryDate: String?

    enum CodingKeys: String, CodingKey {
        case currentSubscription
        case history
        case availablePlans
        case requests
        case payment
        case legacySubscription = "subscription"
        case legacyPlan = "plan"
        case legacyExpiryDate = "expiry_date"
        case legacyExpiryDateCamel = "expiryDate"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        currentSubscription = try container.decodeIfPresent(Subscription.self, forKey: .currentSubscription)
        history = try container.decodeIfPresent([Subscription].self, forKey: .history) ?? []
        availablePlans = try container.decodeIfPresent([SubscriptionPlan].self, forKey: .availablePlans) ?? []
        requests = try container.decodeIfPresent([SubscriptionRequest].self, forKey: .requests) ?? []
        payment = try container.decodeIfPresent(BillingPaymentSettings.self, forKey: .payment)
        legacySubscription = try container.decodeIfPresent(Subscription.self, forKey: .legacySubscription)
        legacyPlan = try container.decodeIfPresent(SubscriptionPlan.self, forKey: .legacyPlan)
        legacyExpiryDate = try container.decodeIfPresent(String.self, forKey: .legacyExpiryDate)
            ?? container.decodeIfPresent(String.self, forKey: .legacyExpiryDateCamel)
    }

    var subscription: Subscription? {
        currentSubscription ?? legacySubscription
    }

    var plan: SubscriptionPlan? {
        if let legacyPlan {
            return legacyPlan
        }
        guard let subscription else { return nil }
        return subscription.asPlan
    }

    var expiryDate: String? {
        subscription?.endDate ?? legacyExpiryDate
    }
}

struct Subscription: Decodable, Identifiable {
    let id: Int
    let status: String
    let computedStatus: String?
    let startDate: String?
    let endDate: String?
    let planId: Int?
    let planName: String?
    let planPrice: Double?
    let planRegularPrice: Double?
    let planOfferPrice: Double?
    let planOfferEnabled: Bool?
    let planEffectivePrice: Double?
    let planCurrency: String?
    let planDurationDays: Int?
    let planRecommended: Bool?
    let planFeatures: [String]?
    let paymentMethod: String?
    let paymentReference: String?
    let paymentStatus: String?
    let daysRemaining: Int?
    let isFreePlan: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case computedStatus
        case startDate
        case startDateSnake = "start_date"
        case endDate
        case endDateSnake = "end_date"
        case planId
        case planIdSnake = "plan_id"
        case planName
        case planPrice
        case planRegularPrice
        case planOfferPrice
        case planOfferEnabled
        case planEffectivePrice
        case planCurrency
        case planDurationDays
        case planRecommended
        case planFeatures
        case paymentMethod
        case paymentReference
        case paymentStatus
        case daysRemaining
        case isFreePlan
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? ""
        computedStatus = try container.decodeIfPresent(String.self, forKey: .computedStatus)
        startDate = try container.decodeIfPresent(String.self, forKey: .startDate)
            ?? container.decodeIfPresent(String.self, forKey: .startDateSnake)
        endDate = try container.decodeIfPresent(String.self, forKey: .endDate)
            ?? container.decodeIfPresent(String.self, forKey: .endDateSnake)
        planId = try container.decodeIfPresent(Int.self, forKey: .planId)
            ?? container.decodeIfPresent(Int.self, forKey: .planIdSnake)
        planName = try container.decodeIfPresent(String.self, forKey: .planName)
        planPrice = try container.decodeIfPresent(Double.self, forKey: .planPrice)
        planRegularPrice = try container.decodeIfPresent(Double.self, forKey: .planRegularPrice)
        planOfferPrice = try container.decodeIfPresent(Double.self, forKey: .planOfferPrice)
        planOfferEnabled = try container.decodeIfPresent(Bool.self, forKey: .planOfferEnabled)
        planEffectivePrice = try container.decodeIfPresent(Double.self, forKey: .planEffectivePrice)
        planCurrency = try container.decodeIfPresent(String.self, forKey: .planCurrency)
        planDurationDays = try container.decodeIfPresent(Int.self, forKey: .planDurationDays)
        planRecommended = try container.decodeIfPresent(Bool.self, forKey: .planRecommended)
        planFeatures = try container.decodeIfPresent([String].self, forKey: .planFeatures)
        paymentMethod = try container.decodeIfPresent(String.self, forKey: .paymentMethod)
        paymentReference = try container.decodeIfPresent(String.self, forKey: .paymentReference)
        paymentStatus = try container.decodeIfPresent(String.self, forKey: .paymentStatus)
        daysRemaining = try container.decodeIfPresent(Int.self, forKey: .daysRemaining)
        isFreePlan = try container.decodeIfPresent(Bool.self, forKey: .isFreePlan)
    }

    var isActive: Bool { (computedStatus ?? status) == "active" }
    var isExpired: Bool { (computedStatus ?? status) == "expired" }

    var asPlan: SubscriptionPlan? {
        guard let planId, let planName else { return nil }
        return SubscriptionPlan(
            id: planId,
            name: planName,
            price: planEffectivePrice ?? planPrice,
            durationDays: planDurationDays,
            features: planFeatures,
            currency: planCurrency,
            recommended: planRecommended ?? false
        )
    }
}

struct SubscriptionPlan: Decodable, Identifiable {
    let id: Int
    let name: String
    let price: Double?
    let durationDays: Int?
    let features: [String]?
    let currency: String?
    let recommended: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case price
        case effectivePrice
        case durationDays
        case durationDaysSnake = "duration_days"
        case features
        case currency
        case recommended
    }

    init(
        id: Int,
        name: String,
        price: Double?,
        durationDays: Int?,
        features: [String]?,
        currency: String?,
        recommended: Bool
    ) {
        self.id = id
        self.name = name
        self.price = price
        self.durationDays = durationDays
        self.features = features
        self.currency = currency
        self.recommended = recommended
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Subscription"
        price = try container.decodeIfPresent(Double.self, forKey: .effectivePrice)
            ?? container.decodeIfPresent(Double.self, forKey: .price)
        durationDays = try container.decodeIfPresent(Int.self, forKey: .durationDays)
            ?? container.decodeIfPresent(Int.self, forKey: .durationDaysSnake)
        features = try container.decodeIfPresent([String].self, forKey: .features)
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
        recommended = try container.decodeIfPresent(Bool.self, forKey: .recommended) ?? false
    }
}

struct SubscriptionRequestBody: Encodable {
    let planId: Int
    let message: String?
}

struct ManualPaymentRequest: Encodable {
    let planId: Int
    let message: String?
    let paymentReference: String?
    let proofFileName: String?
    let proofMimeType: String?
    let proofDataUrl: String?
}

struct PayHereInitiateResponse: Decodable {
    let ok: Bool?
    let provider: String?
    let actionUrl: String?
    let invoiceId: String?
    let orderId: String?
    let requestId: Int?
    let amount: String?
    let currency: String?
    let fields: [String: String]?
}

struct SubscriptionRequestResponse: Decodable {
    let ok: Bool?
    let id: Int?
    let invoiceId: String?
    let amount: String?
    let originalAmount: String?
    let discountAmount: String?
    let couponCode: String?
    let couponMode: String?
    let currency: String?
    let proofUploaded: Bool?
}

struct SubscriptionRequest: Decodable, Identifiable {
    let id: Int
    let status: String
    let planId: Int?
    let invoiceId: String?
    let paymentMethod: String?
    let paymentAmount: Double?
    let paymentCurrency: String?
    let paymentProofDataUrl: String?
    let createdAt: String?
}

struct BillingPaymentSettings: Decodable {
    let payHereEnabled: Bool?
    let bankTransferEnabled: Bool?
    let bankTransferInstructions: String?
    let currency: String?
}

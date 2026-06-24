# PayHere Android SDK (used by payhere_mobilesdk_flutter) — keep classes unobfuscated.
# Retrofit / OkHttp / Okio (PayHere networking)
-keepattributes Signature
-keepattributes *Annotation*
-keep interface retrofit2.** { *; }
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
# PayHere classes
-keep class lk.payhere.** { *; }
-keep interface lk.payhere.androidsdk.PayhereSDK { *; }
-keep interface u2.c { *; }
-keep class lk.payhere.androidsdk.models.PaymentMethodResponse { *; }
-keep class lk.payhere.androidsdk.models.** { *; }
-keep class lk.payhere.androidsdk.** { *; }

import java.util.Properties

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

val keystoreProps = Properties().apply {
    val f = file(System.getenv("SALIK_KEYSTORE_PROPS") ?: rootProject.file("keystore.properties").path)
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.salik.tv"
    compileSdk = 35
    defaultConfig { applicationId = "com.salik.tv"; minSdk = 24; targetSdk = 35; versionCode = 28; versionName = "1.0.0" }
    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) create("release") {
            storeFile = file(keystoreProps.getProperty("storeFile"))
            storePassword = keystoreProps.getProperty("storePassword")
            keyAlias = keystoreProps.getProperty("keyAlias")
            keyPassword = keystoreProps.getProperty("keyPassword")
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }
    lint { checkReleaseBuilds = false }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.webkit:webkit:1.14.0"); implementation("androidx.core:core:1.13.1")
    testImplementation("junit:junit:4.13.2"); testImplementation("org.json:json:20240303")
}

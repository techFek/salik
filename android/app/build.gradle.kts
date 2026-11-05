import java.util.Properties

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

val keystoreProps = Properties().apply {
    val f = file(System.getenv("SALIK_KEYSTORE_PROPS") ?: rootProject.file("keystore.properties").path)
    if (f.exists()) f.inputStream().use { load(it) }
}

/* One place for the app version (android/version.properties); a release tag must match it. */
val versionProps = Properties().apply { rootProject.file("version.properties").inputStream().use { load(it) } }
val salikVersionName: String = versionProps.getProperty("versionName")
val salikVersionCode: Int = versionProps.getProperty("versionCode").toInt()

android {
    namespace = "com.salik.tv"
    compileSdk = 35
    defaultConfig { applicationId = "com.salik.tv"; minSdk = 24; targetSdk = 35; versionCode = salikVersionCode; versionName = salikVersionName }
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

/*
 * Release builds stop early when the signing key is missing (instead of producing an unsigned APK),
 * or when a release tag is given (SALIK_RELEASE_TAG or GITHUB_REF_NAME starting with "v") that does
 * not match versionName.
 */
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        val store = keystoreProps.getProperty("storeFile")
        if (store == null || !file(store).exists()) {
            throw GradleException("Release signing key not found. Set SALIK_KEYSTORE_PROPS or create keystore.properties (storeFile, storePassword, keyAlias, keyPassword).")
        }
        val tag = (System.getenv("SALIK_RELEASE_TAG") ?: System.getenv("GITHUB_REF_NAME"))?.takeIf { it.startsWith("v") }
        if (tag != null && tag != "v$salikVersionName") {
            throw GradleException("Release tag $tag does not match versionName $salikVersionName (android/version.properties).")
        }
    }
}

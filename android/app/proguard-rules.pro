# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# NewPipe Extractor / Rhino / jsoup missing classes
-dontwarn java.beans.**
-dontwarn org.mozilla.javascript.**
-dontwarn com.google.re2j.**
-dontwarn javax.script.**
-keep class org.schabi.newpipe.extractor.** { *; }

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.lighter.os.** { *; }

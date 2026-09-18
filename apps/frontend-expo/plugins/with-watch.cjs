const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject, IOSConfig } = require('expo/config-plugins');

const name = 'TrackingWatch';
const bundle = 'so.tracking.app.watchkitapp';
const unquote = value => String(value).replace(/^"|"$/g, '');

module.exports = function withWatch(config) {
  config.extra ??= {};
  config.extra.eas ??= {};
  config.extra.eas.build = {
    ...config.extra.eas.build,
    experimental: { ios: { appExtensions: [{
      targetName: name,
      bundleIdentifier: bundle,
      entitlements: {
        'com.apple.developer.applesignin': ['Default'],
        'com.apple.security.application-groups': ['group.so.tracking.app'],
      },
    }] } },
  };
  return withXcodeProject(config, config => {
    // Give React Native's privacy aggregation a phone resource before adding the Watch's
    // identically named manifest, so CocoaPods cannot attach/modify the Watch manifest.
    IOSConfig.PrivacyInfo.setPrivacyInfo(config, config.ios?.privacyManifests ?? {});
    const project = config.modResults;
    const objects = project.hash.project.objects;
    fs.cpSync(path.join(config.modRequest.projectRoot, 'native', name),
      path.join(config.modRequest.platformProjectRoot, name), { recursive: true });
    const phone = project.getFirstTarget();
    // xcode's addTargetDependency silently does nothing when these sections are absent.
    objects.PBXTargetDependency ??= {};
    objects.PBXContainerItemProxy ??= {};
    let watch = Object.entries(project.pbxNativeTargetSection())
      .find(([key, value]) => !key.endsWith('_comment') && unquote(value.name) === name);
    if (!watch) {
      const target = project.addTarget(name, 'watch2_app', name, bundle);
      watch = [target.uuid, target.pbxNativeTarget];
      // Modern single-target SwiftUI watchOS app (no WatchKit extension).
      target.pbxNativeTarget.productType = '"com.apple.product-type.application"';
      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      const group = project.addPbxGroup([], name, name);
      project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
      for (const file of fs.readdirSync(path.join(config.modRequest.projectRoot, 'native', name))) {
        if (file.endsWith('.swift')) project.addSourceFile(file, { target: target.uuid }, group.uuid);
      }
      for (const resource of ['Assets.xcassets', 'PrivacyInfo.xcprivacy']) {
        const file = project.addFile(resource, group.uuid);
        file.uuid = project.generateUuid();
        file.target = target.uuid;
        project.addToPbxBuildFileSection(file);
        project.addToPbxResourcesBuildPhase(file);
      }
      project.addFile('Info.plist', group.uuid);
      project.addFile('TrackingWatch.entitlements', group.uuid);
    }
    if (!phone.firstTarget.dependencies.some(dependency => objects.PBXTargetDependency[dependency.value]?.target === watch[0])) {
      project.addTargetDependency(phone.uuid, [watch[0]]);
    }
    const phoneConfigurations = objects.XCConfigurationList[phone.firstTarget.buildConfigurationList].buildConfigurations;
    const configurations = objects.XCConfigurationList[watch[1].buildConfigurationList].buildConfigurations;
    for (const entry of configurations) {
      const configuration = objects.XCBuildConfiguration[entry.value];
      const parent = phoneConfigurations.map(item => objects.XCBuildConfiguration[item.value])
        .find(item => item.name === configuration.name).buildSettings;
      Object.assign(configuration.buildSettings, {
        PRODUCT_BUNDLE_IDENTIFIER: bundle,
        PRODUCT_NAME: '"$(TARGET_NAME)"',
        SDKROOT: 'watchos', SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
        WATCHOS_DEPLOYMENT_TARGET: '10.0', TARGETED_DEVICE_FAMILY: '4',
        SWIFT_VERSION: '5.0', DEVELOPMENT_TEAM: '7P4CMS849D',
        CODE_SIGN_STYLE: 'Automatic',
        CODE_SIGN_ENTITLEMENTS: `${name}/TrackingWatch.entitlements`,
        INFOPLIST_FILE: `${name}/Info.plist`, GENERATE_INFOPLIST_FILE: 'NO',
        CURRENT_PROJECT_VERSION: parent.CURRENT_PROJECT_VERSION || config.ios?.buildNumber || '1',
        // Expo writes the phone's short version directly to Info.plist.
        MARKETING_VERSION: config.version,
        ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
        SKIP_INSTALL: 'YES', SUPPORTS_MACCATALYST: 'NO',
        SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD: 'NO',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
        SWIFT_EMIT_LOC_STRINGS: 'YES',
      });
    }
    return config;
  });
};

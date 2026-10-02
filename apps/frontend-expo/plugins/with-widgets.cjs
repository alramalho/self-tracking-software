const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const name = 'TrackingWidgets';
const bundle = 'so.tracking.app.widgets';
const entitlements = { 'com.apple.security.application-groups': ['group.so.tracking.app'] };
const unquote = value => String(value).replace(/^"|"$/g, '');

module.exports = function withWidgets(config) {
  config.extra ??= {};
  config.extra.eas ??= {};
  config.extra.eas.build ??= {};
  config.extra.eas.build.experimental ??= {};
  config.extra.eas.build.experimental.ios ??= {};
  const ios = config.extra.eas.build.experimental.ios;
  ios.appExtensions = [...(ios.appExtensions ?? []).filter(target => target.targetName !== name),
    { targetName: name, bundleIdentifier: bundle, entitlements }];
  return withXcodeProject(config, config => {
    const project = config.modResults;
    const objects = project.hash.project.objects;
    fs.cpSync(path.join(config.modRequest.projectRoot, 'native', name),
      path.join(config.modRequest.platformProjectRoot, name), { recursive: true });
    const phone = project.getFirstTarget();
    objects.PBXTargetDependency ??= {};
    objects.PBXContainerItemProxy ??= {};
    let widget = Object.entries(project.pbxNativeTargetSection())
      .find(([key, value]) => !key.endsWith('_comment') && unquote(value.name) === name);
    if (!widget) {
      const target = project.addTarget(name, 'app_extension', name, bundle);
      widget = [target.uuid, target.pbxNativeTarget];
      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      const group = project.addPbxGroup([], name, name);
      project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
      for (const file of fs.readdirSync(path.join(config.modRequest.projectRoot, 'native', name))) {
        if (file.endsWith('.swift')) project.addSourceFile(file, { target: target.uuid }, group.uuid);
      }
      project.addFile('Info.plist', group.uuid);
      project.addFile(`${name}.entitlements`, group.uuid);
      // xcode's addTarget may attach the appex to an earlier Watch copy phase.
      // Move it explicitly into the phone's PlugIns phase.
      const product = target.pbxNativeTarget.productReference;
      const files = Object.entries(objects.PBXBuildFile).filter(([key, file]) =>
        !key.endsWith('_comment') && file.fileRef === product).map(([key]) => key);
      const copyPhases = Object.entries(objects.PBXCopyFilesBuildPhase).filter(([key]) => !key.endsWith('_comment'));
      for (const [, phase] of copyPhases) phase.files = phase.files.filter(file => !files.includes(file.value));
      const phase = copyPhases.find(([, value]) => String(value.dstSubfolderSpec) === '13');
      if (!phase) throw new Error('Widget extension needs a PlugIns embed phase');
      phase[1].name = '"Embed App Extensions"';
      phase[1].files.push(...files.map(value => ({ value, comment: `${name}.appex in Embed App Extensions` })));
      for (const value of files) objects.PBXBuildFile[value].settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
    }
    if (!phone.firstTarget.dependencies.some(dependency => objects.PBXTargetDependency[dependency.value]?.target === widget[0])) {
      project.addTargetDependency(phone.uuid, [widget[0]]);
    }
    const phoneConfigurations = objects.XCConfigurationList[phone.firstTarget.buildConfigurationList].buildConfigurations;
    for (const entry of objects.XCConfigurationList[widget[1].buildConfigurationList].buildConfigurations) {
      const configuration = objects.XCBuildConfiguration[entry.value];
      const parent = phoneConfigurations.map(item => objects.XCBuildConfiguration[item.value])
        .find(item => item.name === configuration.name).buildSettings;
      Object.assign(configuration.buildSettings, {
        PRODUCT_BUNDLE_IDENTIFIER: bundle, PRODUCT_NAME: '"$(TARGET_NAME)"',
        SDKROOT: 'iphoneos', SUPPORTED_PLATFORMS: '"iphoneos iphonesimulator"',
        IPHONEOS_DEPLOYMENT_TARGET: '17.0', TARGETED_DEVICE_FAMILY: '"1,2"',
        SWIFT_VERSION: '5.0', DEVELOPMENT_TEAM: '7P4CMS849D', CODE_SIGN_STYLE: 'Automatic',
        CODE_SIGN_ENTITLEMENTS: `${name}/${name}.entitlements`,
        INFOPLIST_FILE: `${name}/Info.plist`, GENERATE_INFOPLIST_FILE: 'NO',
        CURRENT_PROJECT_VERSION: parent.CURRENT_PROJECT_VERSION || config.ios?.buildNumber || '1',
        MARKETING_VERSION: config.version, SKIP_INSTALL: 'YES',
        APPLICATION_EXTENSION_API_ONLY: 'YES', SUPPORTS_MACCATALYST: 'NO',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
        SWIFT_EMIT_LOC_STRINGS: 'YES',
      });
    }
    return config;
  });
};

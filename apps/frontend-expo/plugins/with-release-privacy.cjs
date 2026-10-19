const { withInfoPlist } = require('expo/config-plugins');

// Store and Safari-install builds must not carry the Expo dev launcher's local
// network request: release builds never use it, and App Review reads every
// purpose string. Its own release strip step did not run (build 206 kept it).
const developmentProfiles = ['development', 'simulator'];

module.exports = function withReleasePrivacy(config) {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (!profile || developmentProfiles.includes(profile)) return config;
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;
    if (/Expo Dev Launcher/i.test(plist.NSLocalNetworkUsageDescription ?? ''))
      delete plist.NSLocalNetworkUsageDescription;
    if (Array.isArray(plist.NSBonjourServices)) {
      plist.NSBonjourServices = plist.NSBonjourServices.filter(
        (service) => service !== '_expo._tcp',
      );
      if (!plist.NSBonjourServices.length) delete plist.NSBonjourServices;
    }
    return config;
  });
};

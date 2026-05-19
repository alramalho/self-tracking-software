#!/usr/bin/env ruby
# Adds WatchAuthPlugin + WatchSessionManager to the App target,
# and creates a TrackingWatch watchOS app target with all its Swift files
# plus an Embed Watch Content build phase on the App target.
#
# Run from: ios/App  (where App.xcodeproj lives)
#   ruby setup_watch_target.rb

require 'xcodeproj'

PROJECT_PATH = 'App.xcodeproj'
APP_TARGET_NAME = 'App'
WATCH_TARGET_NAME = 'TrackingWatch'
WATCH_BUNDLE_ID = 'so.tracking.app.watchkitapp'
PARENT_BUNDLE_ID = 'so.tracking.app'
TEAM_ID = '7P4CMS849D'
WATCHOS_DEPLOYMENT_TARGET = '10.0'
SWIFT_VERSION = '5.0'

project = Xcodeproj::Project.open(PROJECT_PATH)
app_target = project.targets.find { |t| t.name == APP_TARGET_NAME } or abort("App target not found")

# --- 1) Add WatchSessionManager + WatchAuthPlugin to App target ---

app_group = project.main_group.find_subpath('App', true)
watch_bridge_files = %w[WatchSessionManager.swift WatchAuthPlugin.swift]

watch_bridge_files.each do |fname|
  next if app_target.source_build_phase.files_references.any? { |r| r && r.path == fname }

  existing_ref = app_group.files.find { |f| f.path == fname }
  ref = existing_ref || app_group.new_reference(fname)
  app_target.add_file_references([ref])
  puts "[App] added #{fname}"
end

# --- 2) Create TrackingWatch watchOS app target ---

existing_watch_target = project.targets.find { |t| t.name == WATCH_TARGET_NAME }
if existing_watch_target
  puts "[Watch] target already exists, skipping creation"
  watch_target = existing_watch_target
else
  watch_target = project.new_target(
    :application,
    WATCH_TARGET_NAME,
    :watchos,
    WATCHOS_DEPLOYMENT_TARGET,
    nil,
    :swift
  )
  puts "[Watch] created target #{WATCH_TARGET_NAME}"
end

# Group for the watch target sources in the project navigator
watch_group = project.main_group.find_subpath(WATCH_TARGET_NAME, true)
watch_group.set_source_tree('<group>')
watch_group.set_path(WATCH_TARGET_NAME)

watch_swift_files = %w[
  TrackingWatchApp.swift
  AuthManager.swift
  ConnectivityService.swift
  LoginView.swift
  ActivityListView.swift
  LogActivityView.swift
  APIService.swift
  Models.swift
]

watch_swift_files.each do |fname|
  next if watch_target.source_build_phase.files_references.any? { |r| r && r.path == fname }
  existing_ref = watch_group.files.find { |f| f.path == fname }
  ref = existing_ref || watch_group.new_reference(fname)
  watch_target.add_file_references([ref])
  puts "[Watch] src #{fname}"
end

# Assets.xcassets for watch
unless watch_target.resources_build_phase.files_references.any? { |r| r && r.path == 'Assets.xcassets' }
  assets_ref = watch_group.files.find { |f| f.path == 'Assets.xcassets' } ||
               watch_group.new_reference('Assets.xcassets')
  watch_target.add_resources([assets_ref])
  puts "[Watch] resource Assets.xcassets"
end

# Info.plist & entitlements as file references (not in build phases; referenced in build settings)
%w[Info.plist TrackingWatch.entitlements].each do |fname|
  unless watch_group.files.any? { |f| f.path == fname }
    watch_group.new_reference(fname)
    puts "[Watch] ref #{fname}"
  end
end

# Build settings for watch target
watch_target.build_configurations.each do |config|
  s = config.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER']        = WATCH_BUNDLE_ID
  s['PRODUCT_NAME']                     = '$(TARGET_NAME)'
  s['WATCHOS_DEPLOYMENT_TARGET']        = WATCHOS_DEPLOYMENT_TARGET
  s['SDKROOT']                          = 'watchos'
  s['TARGETED_DEVICE_FAMILY']           = '4'
  s['SWIFT_VERSION']                    = SWIFT_VERSION
  s['DEVELOPMENT_TEAM']                 = TEAM_ID
  s['CODE_SIGN_STYLE']                  = 'Automatic'
  s['CODE_SIGN_ENTITLEMENTS']           = "#{WATCH_TARGET_NAME}/TrackingWatch.entitlements"
  s['INFOPLIST_FILE']                   = "#{WATCH_TARGET_NAME}/Info.plist"
  s['GENERATE_INFOPLIST_FILE']          = 'NO'
  s['CURRENT_PROJECT_VERSION']          = '1'
  s['MARKETING_VERSION']                = '1.0'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['SUPPORTS_MACCATALYST']             = 'NO'
  s['SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD'] = 'NO'
  s['SKIP_INSTALL']                     = 'YES'
  s['ENABLE_PREVIEWS']                  = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS']          = '$(inherited) @executable_path/Frameworks'
end

# --- 3) Embed Watch Content into the iPhone app ---

embed_name = 'Embed Watch Content'
existing_embed = app_target.copy_files_build_phases.find { |p| p.name == embed_name }
unless existing_embed
  embed_phase = app_target.new_copy_files_build_phase(embed_name)
  embed_phase.dst_subfolder_spec = '16' # Products Directory
  embed_phase.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
  embed_phase.symbol_dst_subfolder_spec = :products_directory
  product_ref = watch_target.product_reference
  build_file = embed_phase.add_file_reference(product_ref)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "[App] added Embed Watch Content phase"
end

# Intentionally NOT adding app_target.add_dependency(watch_target):
# for iOS+watchOS companion, Xcode uses the Embed Watch Content phase to
# implicitly build the watch target with the correct (watchOS) SDK. A direct
# target dependency propagates the iOS SDK and breaks WatchKit imports.
app_target.dependencies.delete_if { |d| d.target == watch_target }

# Project-level attributes for the watch target (for provisioning)
project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][watch_target.uuid] = {
  'CreatedOnToolsVersion' => '15.0',
  'ProvisioningStyle'     => 'Automatic',
  'DevelopmentTeam'       => TEAM_ID,
}

project.save
puts "Done. Open App.xcworkspace in Xcode."

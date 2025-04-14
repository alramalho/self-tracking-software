#!/bin/bash

# This script is now a wrapper for the aws-tracking-software Python command
# It maintains backward compatibility while using the new Python module

aws-update-item -t tracking_software_users_dev --primary_key_name "id" --primary_key_value "670fb420158ba86def604e67" --key_name "clerk_id" --old_value "user_2nWIRvGq87GHdd8LlSbt7cCOvRf" --new_value "user_2kUW1zytLj9ERvDqVDDFCvIp5Un"
exit $? 
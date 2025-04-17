import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as fs from "fs";
import * as path from "path";

export interface WafAllowlistRuleConstructProps {
  /**
   * Path to the text file containing allowed routes, relative to the CDK app root.
   * Example: 'allowed-routes.txt'
   */
  readonly allowedRoutesFilePath: string;
  /**
   * The scope for WAF resources (REGIONAL or CLOUDFRONT).
   */
  readonly wafScope: "REGIONAL" | "CLOUDFRONT";
  /**
   * Priority for the allowlist rule within the WebACL.
   * Ensure this is unique and ordered correctly relative to other rules.
   */
  readonly rulePriority: number;
}

export class WafAllowlistRuleConstruct extends Construct {
  public readonly allowlistRule: wafv2.CfnWebACL.RuleProperty;
  public readonly regexPatternSet?: wafv2.CfnRegexPatternSet; // Expose for potential reference

  constructor(
    scope: Construct,
    id: string,
    props: WafAllowlistRuleConstructProps
  ) {
    super(scope, id);

    const fullFilePath = path.resolve(props.allowedRoutesFilePath); // Resolve to absolute path from app root
    const regexPatternSetName = "allowed-routes-regex-set"; // Base name

    // 1. Read and parse the routes file
    let routes: string[] = [];
    try {
      const allowedRoutesContent = fs.readFileSync(fullFilePath, "utf-8");
      routes = allowedRoutesContent
        .split(/\r?\n/) // Split by newline (Windows or Unix)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#")); // Filter out empty lines and comments
    } catch (error) {
      console.error(
        `Error reading allowed routes file at ${fullFilePath}:`,
        error
      );
      throw new Error(`Failed to read routes file: ${fullFilePath}`);
    }

    if (routes.length === 0) {
      console.warn(
        `WARN: No valid routes found in ${fullFilePath}. The allowlist rule will not match any paths.`
      );
      // If no routes, create a dummy rule that allows nothing, or handle as needed.
      // For simplicity here, we'll proceed, but the regex set will be empty.
      // Consider throwing an error or creating a no-op rule if this is critical.
    }

    // 2. Convert routes to WAF-compatible regex patterns
    const regexPatterns = routes.map((route) => {
      const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `^${escapedRoute}$`;
    });

    // Default rule property - might be overridden if routes exist
    let ruleStatement: wafv2.CfnWebACL.StatementProperty = {
      // Create a statement that never matches if no routes are provided
      // This avoids errors but ensures the rule slot is technically filled if needed.
      // A better approach might be conditional rule creation in the consuming stack.
      byteMatchStatement: {
        fieldToMatch: { uriPath: {} },
        positionalConstraint: "EXACTLY",
        searchString: `NEVER_MATCH_${cdk.Aws.STACK_NAME}`, // Unique non-matching string
        textTransformations: [{ priority: 0, type: "NONE" }],
      },
    };

    // Only create the RegexSet and Rule if there are routes to allow
    if (regexPatterns.length > 0) {
      // 3. Create the Regex Pattern Set
      // Use a logical ID derived from the construct ID for CDK uniqueness
      this.regexPatternSet = new wafv2.CfnRegexPatternSet(
        this,
        "Resource", // CDK logical ID within the construct scope
        {
          // Construct a unique physical name
          name: `${cdk.Stack.of(this).stackName}-${id}-${regexPatternSetName}-${
            cdk.Aws.REGION
          }`.substring(0, 128), // Ensure name constraints
          scope: props.wafScope,
          regularExpressionList: regexPatterns,
          description: "Regex patterns for allowed URI paths from file",
        }
      );

      ruleStatement = {
        regexPatternSetReferenceStatement: {
          arn: this.regexPatternSet.attrArn,
          fieldToMatch: { uriPath: {} },
          textTransformations: [{ priority: 0, type: "NONE" }],
        },
      };
    } else {
      console.warn(
        `No regex patterns generated for construct ${id} due to empty or invalid routes file.`
      );
    }

    // 4. Define the Allow Rule Property
    this.allowlistRule = {
      name: `${id}AllowListedRoutesRule`, // Use construct ID for unique rule name
      priority: props.rulePriority,
      action: { allow: {} },
      statement: ruleStatement,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        // Use construct ID for unique metric name
        metricName: `${id}AllowListedRoutesMetric`,
        sampledRequestsEnabled: true,
      },
    };
  }
}

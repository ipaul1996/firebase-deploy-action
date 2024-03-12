const { exec } = require("@actions/exec");

const executeOnCLIWithCredentials = async (
  arguments,
  credFileName,
  firebaseToolsVersion
) => {
  let deployBufferOutput = [];

  try {
    await exec(
      `npx firebase-tools@${firebaseToolsVersion}`,
      [...arguments, "--json"],
      {
        env: {
          ...process.env,
          FIREBASE_DEPLOY_AGENT: "firebase-deploy-action",
          GOOGLE_APPLICATION_CREDENTIALS: credFileName,
        },
        listeners: {
          stdout: (data) => deployBufferOutput.push(data),
        },
      }
    );
  } catch (error) {
    throw error;
  }

  return deployBufferOutput.length > 0
    ? deployBufferOutput[deployBufferOutput.length - 1].toString("utf-8")
    : "";
};

const deployToProductionSite = async (
  credFileName,
  productionDeploymentConfig
) => {
  const { deployTarget, firebaseToolsVersion } = productionDeploymentConfig;

  let deploymentRes = await executeOnCLIWithCredentials(
    ["deploy", "--only", `hosting${deployTarget ? ":" + deployTarget : ""}`],
    credFileName,
    firebaseToolsVersion
  );

  deploymentRes = JSON.parse(deploymentRes.trim());

  return deploymentRes;
};

const deployToPreviewChannel = async (credFileName, previwDeploymentConfig) => {
  const {
    deployTarget,
    firebaseToolsVersion,
    previewExpires,
    hostingChannelId,
  } = previwDeploymentConfig;

  let deploymentRes = await executeOnCLIWithCredentials(
    [
      "hosting:channel:deploy",
      hostingChannelId,
      ...(deployTarget ? ["--only", deployTarget] : []),
      "--expires",
      previewExpires,
    ],
    credFileName,
    firebaseToolsVersion
  );

  deploymentRes = JSON.parse(deploymentRes.trim());

  return deploymentRes;
};

module.exports = { deployToProductionSite, deployToPreviewChannel };

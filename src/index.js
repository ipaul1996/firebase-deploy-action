const {
  endGroup,
  getInput,
  setFailed,
  setOutput,
  startGroup,
} = require("@actions/core");
const { existsSync } = require("fs");
const { createCrdentialFile } = require("./createCredentialFile.js");
const {
  deployToProductionSite,
  deployToPreviewChannel,
} = require("./deploy.js");

// Collect all the inputs defined in the action.yml file
// Mandatory inputs
const firebaseServiceAccount = getInput("firebaseServiceAccount", {
  required: true,
});
let deploymentType = getInput("deploymentType", {
  required: true,
});

// Optional inputs
let previewExpires = getInput("previewExpires");
let entryPoint = getInput("entryPoint");
let firebaseToolsVersion = getInput("firebaseToolsVersion");
let hostingChannelId = getInput("hostingChannelId");
let deployTarget = getInput("deployTarget");


// In case of preview create a random channelID of 10 chracters
const getRandomChannelID = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let res = "";

  for (let i = 0; i < 10; i++) {
    let randomIndex = Math.floor(Math.random() * characters.length);
    res += characters[randomIndex];
  }

  return res;
};

// Extract the production deployment url
const extractProductionDeployURL = (url) => {
  const site_id = url.match(/sites\/(.*?)\/versions/)[1];
  const deploy_url = `https://${site_id}.web.app`;
  return deploy_url;
};



let deploymentUrls = [];
let expireTimeStamp;



const run = async () => {
  try {
    // Check if the firebase.json file exists
    startGroup("Checking firebase.json exists");

    if (entryPoint !== ".") {
      try {
        process.chdir(entryPoint);
        console.log(
          `Current working directory has been changed to ${entryPoint}`
        );
      } catch (error) {
        throw new Error(
          `Error changing current working directory to ${entryPoint}`
        );
      }
    }

    if (existsSync("./firebase.json")) {
      console.log(
        `firebase.json file has been found in the current working directory ${entryPoint}`
      );
    } else {
      throw new Error(
        `firebase.json file has not been found in the current working directory ${entryPoint}`
      );
    }

    endGroup();

    startGroup("Setting up the firebase CLI");
    const credFileName = await createCrdentialFile(firebaseServiceAccount);
    console.log(
      "Created a temporary file with firebase service account credentials"
    );
    endGroup();

    if (deploymentType === "live") {
      startGroup("Deploying to production site");
      const deployment = await deployToProductionSite(credFileName, {
        deployTarget,
        firebaseToolsVersion,
      });

      if (deployment.status === "error") {
        throw new Error(deployment.error);
      }

      typeof deployment.result.hosting === "string"
        ? deploymentUrls.push(
            extractProductionDeployURL(deployment.result.hosting)
          )
        : deployment.result.hosting.forEach((url) => {
            let deployUrl = extractProductionDeployURL(url);
            deploymentUrls.push(deployUrl);
          });

      console.log("Deployment Result: ");
      console.log(deployment);

      console.log("Production deployment URLs: ", deploymentUrls);

      setOutput("deploy_urls", deploymentUrls);
      setOutput("deploy_url", deploymentUrls[0]);

      endGroup();
    } else {
      if (deploymentType.toLowerCase() !== "preview") {
        throw Error("Deployment type should be live or preview");
      }

      hostingChannelId = hostingChannelId
        ? hostingChannelId
        : getRandomChannelID();

      startGroup(`Deploying to preview channel: ${hostingChannelId}`);

      const deployment = await deployToPreviewChannel(credFileName, {
        deployTarget,
        firebaseToolsVersion,
        previewExpires,
        hostingChannelId,
      });

      if (deployment.status === "error") {
        throw new Error(deployment.error);
      }

      let deploymentResult = deployment.result;

      for (let key in deploymentResult) {
        if (!expireTimeStamp) {
          expireTimeStamp = deploymentResult[key].expireTime;
        }

        deploymentUrls.push(deploymentResult[key].url);
      }

      console.log("Deployment Result: ");
      console.log(deployment);

      console.log("Preview URLs: ", deploymentUrls);

      setOutput("deploy_urls", deploymentUrls);
      setOutput("deploy_url", deploymentUrls[0]);
      setOutput("preview_expires", expireTimeStamp);

      endGroup();
    }
  } catch (error) {
    setFailed(error.message);
  }
};

run();

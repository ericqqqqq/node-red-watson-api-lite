"use strict";
const AssistantV2 = require("ibm-watson/assistant/v2");
const { IamAuthenticator } = require("ibm-watson/auth");

let payload = null;

module.exports = function(RED) {
  function WatsonAssistant(config) {
    RED.nodes.createNode(this, config);

    this.apikey = config.apikey;
    this.url = config.url;
    this.assistantId = config.assistantId;
    const node = this;

    node.on("input", main);

    function main(msg) {
      const assistant = new AssistantV2({
        version: "2019-02-28",
        authenticator: new IamAuthenticator({
          apikey: node.apikey
        }),
        url: node.url
      });

      if (!payload) {
        payload = {
          assistantId: node.assistantId
        };
      }

      if (payload && payload.text) {
        delete payload.text;
      }

      let { text, mode } = msg.payload;

      if (!mode) {
        mode = "create";
      }

      if (mode === "create") {
        createAssistantSession(assistant, payload)
          .then(payloadWithSessionId => {
            payload = payloadWithSessionId;
            payload.text = text;

            return sendInputToAssistant(assistant, payload);
          })
          .then(res => {
            msg.payload = Object.assign(res, { type: "create" });
            node.send(msg);
          })
          .catch(err => {
            msg.payload = err;
            ``;
            node.send(msg);
          });

        return;
      }

      if (mode === "continue") {
        payload.text = text;

        sendInputToAssistant(assistant, payload)
          .then(res => {
            msg.payload = Object.assign(res, { type: "continue" });
            node.send(msg);
          })
          .catch(err => {
            msg.payload = err;
            node.send(msg);
          });

        return;
      }
      if (mode === "delete") {
        deleteAssistantSession(assistant, payload)
          .then(payloadWithoutSessionId => {
            payload = payloadWithoutSessionId;

            msg.payload = {
              status: 200,
              message: "deleted session id",
              type: "delete"
            };
            node.send(msg);
          })
          .catch(err => {
            msg.payload = err;
            node.send(msg);
          });
      }
    }
  }
  RED.nodes.registerType("watson-assistant-lite", WatsonAssistant);
};

function createAssistantSession(assistantIns, pl) {
  const { assistantId } = pl;

  return new Promise((resolve, reject) => {
    assistantIns
      .createSession({
        assistantId
      })
      .then(res => {
        const { session_id } = res.result;
        const payloadWithSessionId = Object.assign(pl, {
          sessionId: session_id
        });

        resolve(payloadWithSessionId);
      })
      .catch(err => {
        reject({
          status: err.code,
          message: err.message,
          body: err.body,
          type: "error"
        });
      });
  });
}

function deleteAssistantSession(assistantIns, pl) {
  const { assistantId, sessionId } = pl;

  return new Promise((resolve, reject) => {
    assistantIns
      .deleteSession({
        assistantId,
        sessionId
      })
      .then(res => {
        if (res.status === 200) {
          const payloadWithoutSessionId = pl;
          delete payloadWithoutSessionId.sessionId;

          resolve(payloadWithoutSessionId);
        }
        reject({
          status: res.status,
          message: res.statusText,
          type: "error"
        });
      })
      .catch(err => {
        reject({
          status: err.code,
          message: err.message,
          body: err.body,
          type: "error"
        });
      });
  });
}

function sendInputToAssistant(assistantIns, pl) {
  const { assistantId, sessionId, text } = pl;
  return new Promise((resolve, reject) => {
    assistantIns
      .message({
        assistantId,
        sessionId: sessionId,
        input: {
          message_type: "text",
          text
        }
      })
      .then(res => {
        resolve(res.result.output);
      })
      .catch(err => {
        reject({
          status: err.code,
          message: err.message,
          body: err.body,
          type: "error"
        });
      });
  });
}

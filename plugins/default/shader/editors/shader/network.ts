import ui, { setupUniform, setUniformValueInputs, setupAttribute, setupEditors } from "./ui";
import { setupPreview } from "./engine";
import ShaderAsset from "../../data/ShaderAsset";
import { UniformPub } from "../../data/Uniforms";
import { AttributePub } from "../../data/Attributes";

export let data: { projectClient?: SupClient.ProjectClient, shaderAsset?: ShaderAsset, previewComponentUpdater?: any };

export let socket: SocketIOClient.Socket;
SupClient.i18n.load([], () => {
  socket = SupClient.connect(SupClient.query.project);
  socket.on("welcome", onWelcome);
  socket.on("disconnect", SupClient.onDisconnected);
});

function onWelcome(clientId: number) {
  data = { projectClient: new SupClient.ProjectClient(socket, { subEntries: true }) };
  setupEditors(clientId);

  data.projectClient.subAsset(SupClient.query.asset, "shader", { onAssetReceived, onAssetEdited, onAssetTrashed });
}

function onAssetReceived(assetId: string, asset: ShaderAsset) {
  data.shaderAsset = asset;

  for (let uniform of asset.pub.uniforms) setupUniform(uniform);
  ui.useLightUniformsCheckbox.checked = asset.pub.useLightUniforms;

  for (let attribute of asset.pub.attributes) setupAttribute(attribute);

  ui.vertexEditor.setText(asset.pub.vertexShader.draft);
  if (asset.pub.vertexShader.draft !== asset.pub.vertexShader.text) checkVertexShader();

  ui.fragmentEditor.setText(asset.pub.fragmentShader.draft);
  if (asset.pub.fragmentShader.draft !== asset.pub.fragmentShader.text) checkFragmentShader();

  setupPreview();
}

const onEditCommands: { [command: string]: Function; } = {};
function onAssetEdited(id: string, command: string, ...args: any[]) {
  const commandFunction = onEditCommands[command];
  if (commandFunction != null) commandFunction.apply(this, args);

  if (ui.previewTypeSelect.value !== "Asset" && command !== "editVertexShader" && command !== "editFragmentShader")
    setupPreview();
}

onEditCommands["setProperty"] = (path: string, value: any) => {
  switch (path) {
    case "useLightUniforms":
      ui.useLightUniformsCheckbox.checked = value;
      break;
  }
};

onEditCommands["newUniform"] = (uniform: UniformPub) => { setupUniform(uniform); };
onEditCommands["deleteUniform"] = (id: string) => {
  let rowElt = <HTMLTableRowElement>ui.uniformsList.querySelector(`[data-id='${id}']`);
  rowElt.parentElement.removeChild(rowElt);
};
onEditCommands["setUniformProperty"] = (id: string, key: string, value: any) => {
  let rowElt = <HTMLDivElement>ui.uniformsList.querySelector(`[data-id='${id}']`);
  if (key === "value") {
    let type = data.shaderAsset.uniforms.byId[id].type;
    switch(type) {
      case "f":
        let floatInputElt = <HTMLInputElement>rowElt.querySelector(".float");
        floatInputElt.value = value;
        break;

      case "c":
      case "v2":
      case "v3":
      case "v4":
        setUniformValues(rowElt, type, value);
        break;
      case "t":
        let textInputElt = <HTMLInputElement>rowElt.querySelector(".text");
        textInputElt.value = value;
        break;
    }

  } else {
    let fieldElt = <HTMLInputElement>rowElt.querySelector(`.${key}`);
    fieldElt.value = value;
  }
  if (key === "type") setUniformValueInputs(id);
};

function setUniformValues(parentElt: HTMLDivElement, name: string, values: number[]) {
  for (let i = 0; i < values.length; i++)
    (<HTMLInputElement>parentElt.querySelector(`.${name}_${i}`)).value = values[i].toString();
}

onEditCommands["newAttribute"] = (attribute: AttributePub) => { setupAttribute(attribute); };
onEditCommands["deleteAttribute"] = (id: string) => {
  let rowElt = <HTMLTableRowElement>ui.attributesList.querySelector(`[data-id='${id}']`);
  rowElt.parentElement.removeChild(rowElt);
};
onEditCommands["setAttributeProperty"] = (id: string, key: string, value: any) => {
  let rowElt = <HTMLDivElement>ui.attributesList.querySelector(`[data-id='${id}']`);
  let fieldElt = <HTMLInputElement>rowElt.querySelector(`.${key}`);
  fieldElt.value = value;
};

onEditCommands["editVertexShader"] = (operationData: OperationData) => {
  ui.vertexEditor.receiveEditText(operationData);
  checkVertexShader();
};
onEditCommands["saveVertexShader"] = () => {
  (<any>ui.vertexHeader.classList).toggle("has-draft", false);
  (<any>ui.vertexHeader.classList).toggle("has-errors", false);
  ui.vertexSaveElt.hidden = true;
};

onEditCommands["editFragmentShader"] = (operationData: OperationData) => {
  ui.fragmentEditor.receiveEditText(operationData);
  checkFragmentShader();
};
onEditCommands["saveFragmentShader"] = () => {
  (<any>ui.fragmentHeader.classList).toggle("has-draft", false);
  (<any>ui.fragmentHeader.classList).toggle("has-errors", false);
  ui.fragmentSaveElt.hidden = true;
};

function onAssetTrashed() {
  SupClient.onAssetTrashed();
}

let gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext;
function replaceShaderChunk(shader: string) {
  let keyword = "THREE_ShaderChunk(";
  let index = shader.indexOf(keyword);
  while (index !== -1) {
    let end = shader.indexOf(")", index + 1);
    let shaderChunk = shader.slice(index + keyword.length, end);
    shaderChunk.trim();
    shader = shader.slice(0, index) + SupEngine.THREE.ShaderChunk[shaderChunk] + shader.slice(end + 1);

    index = shader.indexOf(keyword, index + 1);
  }
  return shader;
}

let vertexStart = `precision mediump float;precision mediump int;
#define SHADER_NAME ShaderMaterial
#define VERTEX_TEXTURES
#define GAMMA_FACTOR 2
#define MAX_DIR_LIGHTS 0
#define MAX_POINT_LIGHTS 0
#define MAX_SPOT_LIGHTS 0
#define MAX_HEMI_LIGHTS 0
#define MAX_SHADOWS 0
#define MAX_BONES 251
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
#ifdef USE_COLOR
  attribute vec3 color;
#endif
#ifdef USE_MORPHTARGETS
  attribute vec3 morphTarget0;
  attribute vec3 morphTarget1;
  attribute vec3 morphTarget2;
  attribute vec3 morphTarget3;
  #ifdef USE_MORPHNORMALS
    attribute vec3 morphNormal0;
    attribute vec3 morphNormal1;
    attribute vec3 morphNormal2;
    attribute vec3 morphNormal3;
  #else
    attribute vec3 morphTarget4;
    attribute vec3 morphTarget5;
    attribute vec3 morphTarget6;
    attribute vec3 morphTarget7;
  #endif
#endif
#ifdef USE_SKINNING
  attribute vec4 skinIndex;
  attribute vec4 skinWeight;
#endif
`;
let vertexStartLength = vertexStart.split("\n").length;

function checkVertexShader() {
  let shader = gl.createShader(gl.VERTEX_SHADER);
  let shaderCode = replaceShaderChunk(ui.vertexEditor.codeMirrorInstance.getDoc().getValue());
  gl.shaderSource(shader, `${vertexStart}\n${shaderCode}`);
  gl.compileShader(shader);
  let log = gl.getShaderInfoLog(shader);

  let errors = log.split("\n");
  if (errors[errors.length - 1] === "") errors.pop();
  for (let error of errors) {
    error = error.replace("ERROR: 0:", "");
    let lineLimiterIndex = error.indexOf(":");
    let line = parseInt(error.slice(0, lineLimiterIndex), 10) - vertexStartLength;
    let message = error.slice(lineLimiterIndex + 2);
    console.log(`Error at line "${line}": ${message}`);
  }

  ui.vertexHeader.classList.toggle("has-errors", errors.length > 0);
  ui.vertexHeader.classList.toggle("has-draft", true);
  ui.vertexSaveElt.hidden = errors.length > 0;
}

let fragmentStart = `precision mediump float;
precision mediump int;
#define SHADER_NAME ShaderMaterial
#define MAX_DIR_LIGHTS 0
#define MAX_POINT_LIGHTS 0
#define MAX_SPOT_LIGHTS 0
#define MAX_HEMI_LIGHTS 0
#define MAX_SHADOWS 0
#define GAMMA_FACTOR 2
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
`;
let fragmentStartLength = fragmentStart.split("\n").length;

function checkFragmentShader() {
  let shader = gl.createShader(gl.FRAGMENT_SHADER);
  let shaderCode = replaceShaderChunk(ui.fragmentEditor.codeMirrorInstance.getDoc().getValue());
  gl.shaderSource(shader, `${fragmentStart}\n${shaderCode}`);
  gl.compileShader(shader);
  let log = gl.getShaderInfoLog(shader);

  let errors = log.split("\n");
  if (errors[errors.length - 1] === "") errors.pop();
  for (let error of errors) {
    error = error.replace("ERROR: 0:", "");
    let lineLimiterIndex = error.indexOf(":");
    let line = parseInt(error.slice(0, lineLimiterIndex), 10) - fragmentStartLength;
    let message = error.slice(lineLimiterIndex + 2);
    console.log(`Error at line "${line}": ${message}`);
  }
  ui.fragmentHeader.classList.toggle("has-errors", errors.length > 0);
  ui.fragmentHeader.classList.toggle("has-draft", true);
  ui.fragmentSaveElt.hidden = errors.length > 0;
}



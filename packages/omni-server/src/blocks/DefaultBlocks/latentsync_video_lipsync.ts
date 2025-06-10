/**
 * Copyright (c) 2023-2024 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */

import { OAIBaseComponent, type WorkerContext, OmniComponentMacroTypes, BlockCategory as Category } from 'omni-sockets';
import axios from 'axios';

const NAMESPACE = 'ai_video_tools';
const OPERATION_ID = 'latentsync_video_lipsync';
const TITLE = 'LatentSync Video Lip Sync';
const DESCRIPTION = 'Processes a video and an audio file to produce a lip-synced video using LatentSync 1.5.';
const CATEGORY = Category.AI_GENERATION;

const inputs = [
  { name: 'video_file_path', type: 'string', title: 'Video File Path', description: 'Path to the input video file.', required: true },
  { name: 'audio_file_path', type: 'string', title: 'Audio File Path', description: 'Path to the input audio file.', required: true },
  { name: 'inference_steps', type: 'number', defaultValue: 20, minimum: 1, maximum: 100, step: 1, title: 'Inference Steps', description: 'Number of inference steps (e.g., 20-50). Higher is better quality but slower.' },
  { name: 'guidance_scale', type: 'number', defaultValue: 2.0, minimum: 0.1, maximum: 10.0, step: 0.1, title: 'Guidance Scale', description: 'Controls lip-sync accuracy vs. video distortion (e.g., 1.0-3.0).' },
];

const outputs = [
  { name: 'processed_video_path', type: 'string', title: 'Processed Video Path', description: 'Path to the lip-synced output video file.' },
  { name: 'error_message', type: 'string', title: 'Error Message', description: 'Error message if processing failed.' },
];

let baseComponent = OAIBaseComponent.create(NAMESPACE, OPERATION_ID)
  .fromScratch()
  .set('title', TITLE)
  .set('category', CATEGORY)
  .set('description', DESCRIPTION)
  .setMethod('X-CUSTOM');

function addInputs(component: OAIBaseComponent, inputDefinitions: any[]) {
  for (const inputDef of inputDefinitions) {
    const input = component.createInput(inputDef.name, inputDef.type)
      .set('title', inputDef.title)
      .set('description', inputDef.description);
    // .set('customSocket', inputDef.customSocket); // Commented out due to potential issues

    if (inputDef.required) {
      input.setRequired(true);
    }
    if (inputDef.defaultValue !== undefined) {
      input.set('defaultValue', inputDef.defaultValue);
    }
    if (inputDef.minimum !== undefined) {
      input.set('minimum', inputDef.minimum);
    }
    if (inputDef.maximum !== undefined) {
      input.set('maximum', inputDef.maximum);
    }
    if (inputDef.step !== undefined) {
      input.set('step', inputDef.step);
    }
    component.addInput(input.toOmniIO());
  }
  return component;
}

function addOutputs(component: OAIBaseComponent, outputDefinitions: any[]) {
  for (const outputDef of outputDefinitions) {
    const output = component.createOutput(outputDef.name, outputDef.type)
      .set('title', outputDef.title)
      .set('description', outputDef.description);
    // .set('customSocket', outputDef.customSocket); // Commented out due to potential issues
    component.addOutput(output.toOmniIO());
  }
  return component;
}

baseComponent = addInputs(baseComponent, inputs);
baseComponent = addOutputs(baseComponent, outputs);

baseComponent.setMacro(OmniComponentMacroTypes.EXEC, async (payload: any, ctx: WorkerContext) => {
  const { video_file_path, audio_file_path, inference_steps, guidance_scale } = payload;

  const PYTHON_MICROSERVICE_ENDPOINT = process.env.LATENTSYNC_SERVICE_ENDPOINT || 'http://localhost:5177/lipsync';

  try {
    ctx.app.log.info(\`[${NAMESPACE}.${OPERATION_ID}] Calling LatentSync service for video: ${video_file_path}, audio: ${audio_file_path}\`);

    const response = await axios.post(PYTHON_MICROSERVICE_ENDPOINT, {
      video_path: video_file_path,
      audio_path: audio_file_path,
      inference_steps: inference_steps,
      guidance_scale: guidance_scale,
    });

    if (response.data && response.data.output_video_path) {
      ctx.app.log.info(\`[${NAMESPACE}.${OPERATION_ID}] Lip-sync successful. Output: ${response.data.output_video_path}\`);
      return { result: { ok: true }, processed_video_path: response.data.output_video_path, error_message: null };
    } else if (response.data && response.data.error) {
      ctx.app.log.error(\`[${NAMESPACE}.${OPERATION_ID}] Error from LatentSync service: ${response.data.error}\`);
      return { result: { ok: false }, processed_video_path: null, error_message: response.data.error };
    } else {
      ctx.app.log.error(\`[${NAMESPACE}.${OPERATION_ID}] Unknown error or invalid response from LatentSync service.\`);
      return { result: { ok: false }, processed_video_path: null, error_message: 'Unknown error from LatentSync service.' };
    }

  } catch (error: any) {
    const errorMessage = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : error.message || 'Failed to call LatentSync service.';
    ctx.app.log.error(\`[${NAMESPACE}.${OPERATION_ID}] Exception calling LatentSync service: ${errorMessage}\`);
    if (axios.isAxiosError(error) && error.response) {
      ctx.app.log.error(\`[${NAMESPACE}.${OPERATION_ID}] Service response: \`, error.response.data);
    }
    return { result: { ok: false }, processed_video_path: null, error_message: errorMessage };
  }
});

export const LatentSyncVideoLipSyncComponent = baseComponent.toJSON();

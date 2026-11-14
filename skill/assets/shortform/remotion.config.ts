import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.overrideWebpackConfig((c) => c);

// @remotion/effects (fx[]) need WebGL2 — render with ANGLE
Config.setChromiumOpenGlRenderer('angle');

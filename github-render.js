const fs = require('fs');
const path = require('path');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');

<<<<<<< HEAD
// 1. 출력 폴더 보장
const outputDir = path.join(__dirname, 'output');
=======
// [FIX 1] 실행 환경에 종속되지 않는 범용적인 절대 경로 보장
const outputDir = path.resolve(__dirname, 'output');
>>>>>>> 4754dde82ac23016b26e357705e195ec51a23879
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function runGitHubRender() {
<<<<<<< HEAD
    console.log("🚀 GitHub Actions: Remotion 렌더링 엔진 가동!");

    const decodeBase64 = (str) => {
        if (!str) return "";
        return Buffer.from(str, 'base64').toString('utf8');
    };

    let title = decodeBase64(process.env.POST_TITLE) || "제목 없음";
    let content = decodeBase64(process.env.POST_CONTENT) || "내용 없음";

    // 💡 방어 전략: 제어문자 정제
    const safeReplace = (text) => {
        return text
            .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
            .replace(/"/g, "'")
            .trim();
    };

    title = safeReplace(title);
    content = safeReplace(content);
    
=======
    const { renderTwickVideo } = await import('@twick/render-server');

    // Base64 디코딩 시 명시적 utf8 처리
    const decodeBase64 = (str) => {
        if (!str) return "";
        return Buffer.from(str, 'base64').toString('utf8');
    };

    let title = decodeBase64(process.env.POST_TITLE) || "제목 없음";
    let content = decodeBase64(process.env.POST_CONTENT) || "내용 없음";
    
    // [FIX 2] 제어문자 정제 오류 수정: 줄바꿈(\n), 탭(\t)은 살리고 시스템 파괴 문자만 제거
    const safeReplace = (text) => {
        return text
            .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // 널바이트 및 특수 제어문자 컷
            .replace(/"/g, "'") // JSON.parse 충돌 방지를 위해 쌍따옴표만 홑따옴표로 안전 치환
            .trim();
    };

    title = safeReplace(title);
    content = safeReplace(content);

    const templateCode = decodeBase64(process.env.TEMPLATE_CODE);
    // [FIX 3] 템플릿 파일 역시 절대 경로로 고정
    const templatePath = path.resolve(__dirname, 'Template.jsx');
    
    const typingSpeedMs = 40;
    const charsPerSecond = 1000 / typingSpeedMs;
    const contentLen = content.length > 0 ? content.length : 1; 
    const durationInSeconds = Math.max((contentLen / charsPerSecond) + 2, 5);
    const dynamicDurationInFrames = Math.max(Math.floor(durationInSeconds * 30), 150);

    process.env.DURATION_IN_FRAMES = dynamicDurationInFrames.toString();
    process.env.VIDEO_DURATION = dynamicDurationInFrames.toString();

    if (templateCode) {
        const finalTemplateCode = templateCode + `\n\nexport const durationInFrames = ${dynamicDurationInFrames};\nexport const fps = 30;\nexport const width = 720;\nexport const height = 1280;\n`;
        fs.writeFileSync(templatePath, finalTemplateCode, 'utf8');
    }

>>>>>>> 4754dde82ac23016b26e357705e195ec51a23879
    let inputConfig = {};
    try {
        const decodedConfig = decodeBase64(process.env.POST_CONFIG);
        if (decodedConfig) inputConfig = JSON.parse(decodedConfig);
    } catch (e) {
        console.error("Config Parsing Error:", e);
    }

<<<<<<< HEAD
    const rawTemplateCode = decodeBase64(process.env.TEMPLATE_CODE);
    const templatePath = path.resolve(__dirname, 'Template.jsx');
    
    // DB에서 기존 Twick 코드가 넘어올 것을 대비하여 강제로 remotion으로 임포트 변경
    const fixedTemplateCode = rawTemplateCode ? rawTemplateCode.replace(/@twick\/core/g, 'remotion') : '';
    if (fixedTemplateCode) {
        fs.writeFileSync(templatePath, fixedTemplateCode, 'utf8');
    }

    // 2. 프레임 계산 로직
    const typingSpeedMs = 40;
    const charsPerSecond = 1000 / typingSpeedMs;
    const contentLen = content.length > 0 ? content.length : 1; 
    const durationInSeconds = Math.max((contentLen / charsPerSecond) + 2, 5);
    const dynamicDurationInFrames = Math.max(Math.floor(durationInSeconds * 30), 150);

    // 3. Remotion Root 설정 파일 동적 생성
    const rootPath = path.resolve(__dirname, 'Root.jsx');
    const rootCode = `
import React from 'react';
import { Composition } from 'remotion';
import Template from './Template';

export const RemotionRoot = () => {
    return (
        <Composition
            id="MainVideo"
            component={Template}
            durationInFrames={${dynamicDurationInFrames}}
            fps={30}
            width={720}
            height={1280}
        />
    );
};
    `;
    fs.writeFileSync(rootPath, rootCode, 'utf8');

    // 4. Remotion Entry 등록 파일 생성
    const entryPath = path.resolve(__dirname, 'index.js');
    const entryCode = `
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';
registerRoot(RemotionRoot);
    `;
    fs.writeFileSync(entryPath, entryCode, 'utf8');

    console.log(`[INFO] 번들링 시작 (Frames: ${dynamicDurationInFrames})...`);

    try {
        // 5. Webpack 번들링 수행
        const bundleLocation = await bundle({
            entryPoint: entryPath,
            webpackOverride: (config) => config,
        });

        // 6. 프롭스 세팅 및 컴포지션 선택
        const inputProps = {
            postTitle: title,
            postContent: content,
            views: "1.5만",
            postUp: 842,
            cardBgColor: inputConfig.cardBgColor || "#1a1a24",
            ...inputConfig
        };

        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: 'MainVideo',
            inputProps,
        });

        console.log(`[INFO] 렌더링 시작...`);

        // 7. 비디오 추출
        const finalOutput = path.join(outputDir, 'final_shorts.mp4');
        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: finalOutput,
            inputProps,
            chromiumOptions: {
                gl: 'angle', // 리눅스 환경 필수 옵션
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        console.log(`📂 렌더링 완료! 결과물 위치: ${finalOutput}`);

    } catch (error) {
        console.error("❌ 비디오 렌더링 실패:", error);
=======
    try {
        await renderTwickVideo({
            width: 720,
            height: 1280,
            durationInFrames: dynamicDurationInFrames,
            frames: dynamicDurationInFrames,
            fps: 30,
            concurrency: 4,
            timeoutInMilliseconds: 120000,
            input: {
                entry: templatePath,
                width: 720,
                height: 1280,
                durationInFrames: dynamicDurationInFrames,
                fps: 30,
                properties: {
                    postTitle: title,
                    postContent: content,
                    views: "15,820",
                    postUp: 940,
                    cardBgColor: inputConfig.cardBgColor || "#1a1a24",
                    width: 720,
                    height: 1280,
                    durationInFrames: dynamicDurationInFrames,
                    duration: dynamicDurationInFrames,
                    totalDuration: durationInSeconds,
                    fps: 30,
                    ...inputConfig
                }
            },
            chromiumOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1',
                    '--disable-extensions',
                    '--disable-background-timer-throttling'
                ]
            },
            puppeteerOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1',
                    '--disable-extensions',
                    '--disable-background-timer-throttling'
                ]
            }

        }, { 
            // [FIX 4] GitHub Actions의 업로드 타겟 경로(output 폴더)와 정확히 일치시킴
            outFile: path.join(outputDir, 'final_shorts.mp4'), 
            quality: "high"
        });

    } catch (error) {
        console.error("Render Error:", error);
>>>>>>> 4754dde82ac23016b26e357705e195ec51a23879
        process.exit(1);
    }
}

runGitHubRender();
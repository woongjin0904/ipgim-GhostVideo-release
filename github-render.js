const fs = require('fs');
const path = require('path');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');

// 1. 출력 폴더 보장
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function runGitHubRender() {
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
    
    let inputConfig = {};
    try {
        const decodedConfig = decodeBase64(process.env.POST_CONFIG);
        if (decodedConfig) inputConfig = JSON.parse(decodedConfig);
    } catch (e) {
        console.warn("⚠️ POST_CONFIG 파싱 실패, 기본 UI 설정을 사용합니다.");
    }

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

    // 4. [핵심] Remotion Entry 등록 파일 생성 - 글로벌 폰트(Pretendard 강제화)
    const entryPath = path.resolve(__dirname, 'index.js');
    const entryCode = `
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

// 💡 폰트 강제 주입: 웹 폰트를 로드하고, 모든 요소에 Pretendard 및 Noto 다국어 폰트를 기본 폴백으로 지정
const fontCSS = \`
    @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css");
    * {
        font-family: 'Pretendard', 'Noto Sans CJK KR', 'Noto Color Emoji', sans-serif !important;
    }
\`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = fontCSS;
document.head.appendChild(styleSheet);

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
                // 💡 폰트 렌더링을 매끄럽게 만들기 위해 캐시 및 샌드박스 옵션 추가
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
            }
        });

        console.log(`📂 렌더링 완료! 결과물 위치: ${finalOutput}`);

    } catch (error) {
        console.error("❌ 비디오 렌더링 실패:", error);
        process.exit(1);
    }
}

runGitHubRender();
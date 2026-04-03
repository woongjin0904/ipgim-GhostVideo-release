const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    return originalLaunch.call(puppeteer, {
        ...options,
        headless: "new", // 7.8KB를 뚫어냈던 가장 안정적인 세팅
        defaultViewport: { width: 1080, height: 1920 },
        args: [ 
            ...safeArgs, 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--window-size=1080,1920', 
            '--autoplay-policy=no-user-gesture-required',
            // 🔥 리눅스 서버에서 CSS(backdrop-filter 등)가 화면을 붕괴시키는 것을 방어
            '--disable-gpu',
            '--use-gl=angle',
            '--use-angle=swiftshader'
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 0초 버그 완벽 디버깅 렌더러 가동!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateCode = process.env.TEMPLATE_CODE; 
    const config = JSON.parse(process.env.POST_CONFIG || "{}");
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!templateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    // 1. 유저의 원본 템플릿 파일 생성
    const entryPath = path.join(__dirname, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');

    // 💡 2. [디버깅 특효약] 화면에 프레임 수치와 에러를 직접 찍어내는 래퍼(Wrapper) 생성
    const wrapperPath = path.join(__dirname, `DebugWrapper.jsx`);
    const wrapperCode = `
import React from 'react';
import Template from './${templateName}';
import { useCurrentFrame } from '@twick/core';

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) {
            return (
                <div style={{ width: '1080px', height: '1920px', backgroundColor: '#900', color: '#fff', fontSize: '40px', padding: '50px', boxSizing: 'border-box' }}>
                    <h1 style={{ fontSize: '80px' }}>🚨 React 렌더링 에러!</h1>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error.stack || this.state.error)}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function DebugWrapper(props) {
    const frame = useCurrentFrame();
    return (
        <ErrorBoundary>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '1080px', height: '1920px', backgroundColor: '#000', overflow: 'hidden' }}>
                <Template {...props} />
                {/* 화면 좌측 상단에 실시간 프레임 진행률을 출력합니다 */}
                <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.8)', color: '#0f0', fontSize: '40px', zIndex: 9999, padding: '20px', fontWeight: 'bold' }}>
                    디버그 모니터: 프레임 {frame} / {props.durationInFrames}
                </div>
            </div>
        </ErrorBoundary>
    );
}
    `;
    fs.writeFileSync(wrapperPath, wrapperCode, 'utf8');
    console.log(`✅ 디버그 모니터 래퍼 생성 완료: ${wrapperPath}`);

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 지시: ${totalFrames}프레임 (${estimatedSeconds}초)`);

    try {
        await renderTwickVideo({
            input: {
                entry: wrapperPath, // 유저의 코드를 감싼 디버그 래퍼를 주입합니다.
                properties: {
                    postTitle: title, 
                    postContent: cleanContent, 
                    views: "15,820", 
                    postUp: 940,
                    cardBgColor: config?.cardBgColor || "#1a1a24",
                    durationInFrames: totalFrames, 
                    fps: FPS
                },
                // 🔥 [가장 핵심] 엔진이 0초로 튕기지 않도록 필수 파라미터를 전부 투입합니다.
                durationInFrames: totalFrames, 
                duration: estimatedSeconds, 
                frameCount: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
            }
        }, { 
            outFile: path.join(outputDir, tempVideoName), 
            quality: "high" 
        });

        console.log(`📂 최종 파일 렌더링 완료!`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();
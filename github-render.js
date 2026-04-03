const fs = require('fs');
const path = require('path');

console.log("🚀 GitHub Actions: WebCodecs 버그 돌파 모드 가동!");

// 🔥 [궁극의 해결책 1] Puppeteer의 악성 플래그를 암살하는 OS 레벨 래퍼 생성
const wrapperPath = path.join(__dirname, 'chrome-wrapper.sh');
const wrapperScript = `#!/bin/bash
# Puppeteer가 강제로 넣는 GPU 비활성화 및 Headless 플래그를 중간에서 삭제합니다.
ARGS=()
for arg in "$@"; do
    if [[ "$arg" != "--disable-gpu" && "$arg" != "--headless" && "$arg" != "--headless=\\"new\\"" ]]; then
        ARGS+=("$arg")
    fi
done

# 가짜 GPU(SwiftShader)를 주입하여 WebCodecs 엔진이 0x0으로 붕괴하는 것을 완벽 차단합니다.
exec /usr/bin/google-chrome "\${ARGS[@]}" \\
  --no-sandbox \\
  --disable-dev-shm-usage \\
  --use-gl=angle \\
  --use-angle=swiftshader \\
  --window-size=1080,1920
`;
fs.writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });

// 생성된 래퍼를 환경변수에 등록하여 모든 워커 스레드가 이 가짜 크롬을 거치게 강제
process.env.PUPPETEER_EXECUTABLE_PATH = wrapperPath;


async function runGitHubRender() {
    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 템플릿 코드 누락");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    // 로컬과 동일한 구조 유지를 위해 src 폴더 생성
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
    
    // 유저의 원본 코드를 그대로 저장
    const userTemplatePath = path.join(srcDir, `${templateName}.jsx`);
    fs.writeFileSync(userTemplatePath, templateCode, 'utf8');

    // 🔥 [궁극의 해결책 2] 절대로 0x0으로 무너지지 않는 React 방어벽(Bunker) 
    const bunkerPath = path.join(srcDir, 'RenderBunker.jsx');
    const bunkerCode = `
import React from 'react';
import Template from './${templateName}';

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) {
            // 에러가 나면 1080x1920 크기의 빨간 에러 화면을 렌더링합니다 (인코더 충돌 원천 차단)
            return (
                <div style={{ width: 1080, height: 1920, backgroundColor: '#900', color: '#fff', padding: '60px', boxSizing: 'border-box' }}>
                    <h1 style={{ fontSize: '80px' }}>🚨 React Crash</h1>
                    <pre style={{ fontSize: '40px', whiteSpace: 'pre-wrap' }}>{String(this.state.error.stack || this.state.error)}</pre>
                </div>
            );
        }
        return <Template {...this.props} />;
    }
}

export default function RenderBunker(props) {
    return (
        <div style={{ width: 1080, height: 1920, position: 'absolute', top: 0, left: 0, overflow: 'hidden', backgroundColor: '#000' }}>
            <ErrorBoundary>
                <Template {...props} />
            </ErrorBoundary>
        </div>
    );
}
    `;
    fs.writeFileSync(bunkerPath, bunkerCode, 'utf8');

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 세팅 완료: ${totalFrames}프레임 (${estimatedSeconds}초)`);

    try {
        await renderTwickVideo({
            input: {
                entry: bunkerPath, // 원본 대신 절대 무너지지 않는 벙커를 주입
                properties: {
                    postTitle: title, 
                    postContent: cleanContent, 
                    cardBgColor: config?.cardBgColor || "#1a1a24"
                },
                durationInFrames: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
            }
        }, { 
            outFile: 'final_shorts.mp4', 
            quality: "high" 
        });

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        const finalDest = path.join(outputDir, 'final_shorts.mp4');
        fs.renameSync('final_shorts.mp4', finalDest);
        console.log(`✅ 비디오 렌더링 완벽 성공!`);
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();
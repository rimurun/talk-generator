import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const scriptId = request.nextUrl.searchParams.get('id');
  const fontSize = request.nextUrl.searchParams.get('fs') || '24';
  const color = request.nextUrl.searchParams.get('color') || 'white';
  const bg = request.nextUrl.searchParams.get('bg') || 'transparent';
  const scroll = request.nextUrl.searchParams.get('scroll') || 'false';

  // 未使用変数の lint 警告を回避（将来的にサーバーサイドでスクリプトを取得する際に使用予定）
  void scriptId;

  // OBS Browser Source 用の HTML テンプレート
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif;
    font-size: ${fontSize}px;
    color: ${color};
    background: ${bg};
    padding: 20px;
    line-height: 1.8;
    overflow: hidden;
  }
  .section-title {
    font-size: 0.8em;
    color: #00d4ff;
    font-weight: bold;
    margin-top: 1em;
    margin-bottom: 0.3em;
  }
  .content { white-space: pre-wrap; }
  .question { color: #ffd700; margin-left: 1em; }
  ${scroll === 'true' ? `
  @keyframes scroll {
    0% { transform: translateY(100vh); }
    100% { transform: translateY(-100%); }
  }
  .scroll-container {
    animation: scroll 60s linear infinite;
  }
  ` : ''}
</style>
</head>
<body>
<div id="script" class="${scroll === 'true' ? 'scroll-container' : ''}">
  <div id="content">台本を読み込み中...</div>
</div>
<script>
  // localStorageからスクリプトを読み込む（OBSはlocalStorageにアクセス可能）
  function loadScript() {
    try {
      var scriptData = localStorage.getItem('talkgen_obs_script');
      if (scriptData) {
        var script = JSON.parse(scriptData);
        document.getElementById('content').innerHTML = formatScript(script);
      }
    } catch(e) {
      document.getElementById('content').textContent = '台本データが見つかりません';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatScript(s) {
    var html = '';
    if (s.title) html += '<div style="font-size:1.2em;font-weight:bold;margin-bottom:0.5em">' + escapeHtml(s.title) + '</div>';
    if (s.opening) html += '<div class="section-title">つかみ</div><div class="content">' + escapeHtml(s.opening) + '</div>';
    if (s.explanation) html += '<div class="section-title">説明</div><div class="content">' + escapeHtml(s.explanation) + '</div>';
    if (s.streamerComment) html += '<div class="section-title">コメント</div><div class="content">' + escapeHtml(s.streamerComment) + '</div>';
    if (s.viewerQuestions && s.viewerQuestions.length > 0) {
      html += '<div class="section-title">視聴者への質問</div>';
      s.viewerQuestions.forEach(function(q) {
        html += '<div class="question">&#9658; ' + escapeHtml(q) + '</div>';
      });
    }
    if (s.transition) html += '<div class="section-title">繋ぎ</div><div class="content">' + escapeHtml(s.transition) + '</div>';
    // 事件事故用フィールド
    if (s.factualReport) html += '<div class="section-title">事実報告</div><div class="content">' + escapeHtml(s.factualReport) + '</div>';
    if (s.seriousContext) html += '<div class="section-title">背景</div><div class="content">' + escapeHtml(s.seriousContext) + '</div>';
    return html;
  }

  loadScript();
  // 5秒ごとに再チェック（新しい台本が生成されたら自動更新）
  setInterval(loadScript, 5000);
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

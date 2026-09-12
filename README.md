# mcp-server-lmstudio

LM Studio (ローカル LLM) を **Model Context Protocol (MCP)** 経由で呼び出すためのブリッジサーバーです。

Antigravity IDE、Claude Desktop、Cursor などの MCP 対応クライアントから、完全ローカルで動作する LM Studio のモデル（Qwen、Llama、DeepSeek 等）をツールとして利用できます。

---

## 主な特徴

- �� **WSL2 自動対応**: WSL2 と Windows ホスト間の仮想ネットワーク IP を自動検出し、通信エラーを防止します。
- 🔄 **モデル自動追従**: LM Studio で現在ロードされているモデルを自動判別するため、モデルを変更しても設定の書き換えは不要です。
- 🛡️ **安全・軽量**: 秘密情報や API キーの管理は不要。完全ローカル環境で通信します。

---

## 提供するツール (Tools)

1. `ask_local_llm`
   - ローカル LLM にプロンプトや質問を送信し、回答を取得します。
   - 引数: `prompt` (必須), `system_prompt` (任意), `temperature` (任意)
2. `list_local_models`
   - LM Studio で現在ロード中・利用可能なモデル一覧を取得します。
3. `check_lm_studio_status`
   - LM Studio の Local Server が起動・接続可能か確認します。

---

## 必要要件

- **Node.js**: v18.0.0 以上
- **LM Studio**: 最新版

---

## インストール & セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/ibukichi-jp/mcp-server-lmstudio.git
cd mcp-server-lmstudio
npm install
```

### 2. LM Studio 側の設定

1. LM Studio を起動し、使用したいモデルをロードします。
2. 左サイドバーの **「<-> (Developer / Local Server)」** を開きます。
3. **Serve on local network (0.0.0.0)** または **Enable CORS** を有効にします。
4. **Start Server**（ポート `1234`）をクリックしてサーバーを起動します。

### 3. MCP クライアントへの登録

#### ■ Antigravity IDE の場合
`~/.gemini/config/mcp_config.json` の `mcpServers` に追加します：

```json
{
  "mcpServers": {
    "lm-studio": {
      "command": "node",
      "args": [
        "/path/to/mcp-server-lmstudio/index.mjs"
      ]
    }
  }
}
```

#### ■ Claude Desktop の場合
`claude_desktop_config.json` に追加します：

```json
{
  "mcpServers": {
    "lm-studio": {
      "command": "node",
      "args": [
        "/path/to/mcp-server-lmstudio/index.mjs"
      ]
    }
  }
}
```

---

## ライセンス

MIT License

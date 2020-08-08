# DMM英会話の受講履歴をGithub風の画像にするツール

DMM英会話の履歴ページをGithub風のカレンダーヒートマップにマッピングしてみたくないですが？
私はしたいです。ということで実現するツールを作ってみました。
node/puppeteerを用いていい感じにします

# 実行方法

DMM英会話の履歴はログインしないとみることができないので以下のように環境変数にid/passを設定します。

```
export DMM_USER=example-user@example.io
export DMM_PASSWORD=password
```

チェックアウト後に以下のコマンドを実行すると、dmm-analyzer.pngという画像が生成されます。puppeteerの関係でyarnコマンドが時間がかかります。

```
yarn 
yarn start
```

コマンドが正常に終了すると、dmm-eikaiwa-analytics.pngという画像が生成されます。

例:


大量のリクエストが発生するため少しリクエストの間隔を空けています。そのため実行から画像の出力には10分程度かかります。
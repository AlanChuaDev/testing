# STAR PLAZA · 星光广场

横屏 3D 社交手游原型（纯 WebGL2，无依赖）。把这个 zip 上传到仓库根目录，GitHub Actions 会自动解压、发布网页并打包 APK。

## 地图
| 地图 | 文件 |
| --- | --- |
| 星光广场（含 KTV、时尚街试衣间） | `js/plaza.js` `js/ktv.js` `js/ktvrooms.js` `js/boutique.js` |
| 武吉免登 | `js/scene-bukit-bintang.js` |
| KLCC 双子塔 | `js/scene-klcc.js` `js/scene-common.js` |
| 星光海滩 | `js/scene_beach.js` |
| 星光嘉年华 | `js/scene_funfair.js` |

- 每张地图只有一个**传送阵**（发光圈）：走进去会弹出目的地列表（广场 / 武吉免登 / KLCC / 海滩 / 嘉年华）。KTV 和试衣间是广场里的建筑，仍从各自的门进出。
- 所有地图的长椅 / 圆木都能坐：走近后右下角黄色按钮会变成「坐下」。
- 「姿势」按钮依次切换：挥手 / 跳舞 / 欢呼 / 拍手。
- 黄色互动按钮在六个功能键上方：范围外灰色不可按，进入传送阵 / 互动点 / 座位范围后亮起。

## 背景音乐
`assets/music/*.mp3`（原创合成，每张地图一首，可循环）。设置里可开关、调音量。KTV 包间静音。

## 目录
`index.html` · `css/style.css` · `js/*.js` · `assets/girl.glb`（角色，9 个骨骼动作：idle walk run wave sit sing cheer + 代码生成的 dance clap）· `assets/music/`

## 部署
`.github/workflows/deploy.yml` 与 `.github/scripts/unpack.py`：上传 zip → 解压 → 网页（Pages）+ APK（Release「最新测试 APK」/ Artifacts）。


## K 歌测试模块（新增）
- `assets/songs/xiaoxingyun.mp3`：测试歌曲《小幸运》
- `assets/songs/xiaoxingyun.lrc`：对应时间轴歌词
- `js/karaoke-audio.js`：本地音频播放、LRC 同步歌词、麦克风权限/采集开关
- Android 构建 workflow 增加 `RECORD_AUDIO` 与 `MODIFY_AUDIO_SETTINGS` 权限

**重要限制：** 当前模块能在单个设备上播放伴奏、显示歌词并申请/采集麦克风。它还没有把麦克风音频传给其他玩家。多人实时语音必须另行部署 WebRTC 信令/房间服务（例如自有服务器或受控的实时通信服务），并接入房间成员、上麦状态、音频转发/订阅和断线重连；没有服务地址与部署凭据，无法仅靠静态 HTML/ZIP 实现玩家互相听见。此版本不宣称多人语音已完成。

## 联机（新增）
- `server.js` + `package.json`：部署在 Render 的 WebSocket 服务（房间同步 / 聊天 / 语音信令 / K歌进度同步）。
- `js/net-config.js`：填服务器地址（或在登录界面里填，记在手机里）。
- `js/login.js`：创建角色（昵称+外观），资料保存在本机。
- `js/net.js`：同图玩家同步、世界/同房间聊天、WebRTC 语音（演唱者→听众）、伴奏进度同步。
- 每张地图 = 一个房间；好友进入同一张地图即可互相看到。

## GM 工具：歌词 / 歌曲延迟校准（新增）
- 入口：游戏里 ⚙ 设置 → 最下面「🛠 GM 工具」，输入 GM 密钥登录。
- 可以：试听伴奏（只在本机播放，不影响房间里的人）、调整歌词延迟（±10 / ±100 毫秒）、微调「当前这一句」的时间（±0.1 / ±0.5 秒）、直接编辑 LRC 歌词文本；点「保存并全服更新」后，所有在线玩家立刻更新，新进来的玩家也会拿到最新版。
- 密钥只在服务器验证，客户端代码里没有。Render 上设置环境变量：
  - `GM_KEY`：GM 密钥（必填，不设置则 GM 功能关闭）。请用较长的随机字符串。
  - `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`：可选，Upstash Redis 的地址和令牌。设置后配置永久保存；不设置则只存在服务器本地文件，Render 免费版休眠或重启后会丢，需要重新保存。
- 舞台大电视（广场舞台和 KTV 包间共用同一块屏）：有伴奏播放时显示当前句和下一句，没有伴奏时保持原来的版面。目前只有《小幸运》有伴奏和歌词。


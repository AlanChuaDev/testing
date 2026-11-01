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

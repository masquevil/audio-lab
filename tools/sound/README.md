# tools/sound

参考驱动的环境声合成工具。方法说明见 [docs/sound-synthesis/method.md](../../docs/sound-synthesis/method.md)，实测基准见 [measurements.md](../../docs/sound-synthesis/measurements.md)。

这些脚本只用于开发期：分析参考录音、验证生成结果、生成产品所需的数据表。运行时不依赖它们，`.ai/` 目录被清空也不影响使用。

## 依赖

```bash
pip install -r tools/sound/requirements.txt
# 另需系统安装 ffmpeg
```

`requirements.txt` 已包含 `judge.py` 需要的 `torch` / `transformers`（体积较大）；它们只在 `judge.py` 内按需导入，其余脚本只需要 `numpy` 和 ffmpeg。首次判定会下载 `MIT/ast-finetuned-audioset-10-10-0.4593`（约 350MB）；离线环境设 `HF_HUB_OFFLINE=1` 使用本地缓存。

## 与产品代码的关系

`render-presets.mjs` 通过 Node 的类型剥离直接执行 `src/views/ambience/models/*.ts`，所以这些模块的相对导入显式带 `.ts` 扩展名，运行时不经过构建。

`thunderEnvelopes.ts` 与 `rainLightEnvelope.ts` 由脚本生成，**不要手改**；改模板参数后重新生成，再运行 `pnpm format`。

## 脚本

| 脚本 | 用途 |
| --- | --- |
| `measure.py` | 拆解参考录音的 A/B 结构、频段配比、衰减率、调制谱 |
| `imitate.py` | 用纯合成临摹一段录音，输出保真度指标（引擎能力验证） |
| `acceptance.py` | 把候选与参考集逐维比较，指出越界项 |
| `judge.py` | AudioSet 人类标注模型的类别概率（第三方判据） |
| `build-envelope-data.py` | 由参考录音生成 `src/views/ambience/models/thunderEnvelopes.ts` |
| `build-rain-envelope.py` | 由参考录音生成 `src/views/ambience/models/rainLightEnvelope.ts`（27 段，含 8k/10k/12.5k） |
| `render-presets.mjs` | 把产品预设渲染成 WAV（雷声走产品归一化路径；`--textures` 额外输出雨纹理与篝火底纹，用于判定与试听） |
| `common.py` | 共用：解码、频段分析、噪声重建、指标 |

## 参考音频

参考录音的许可各不相同，**不进仓库**。默认从任意本地目录读取，例如：

```
<refs>/
  event-1.wav          # 起爆明显、雨声很少
  event-3.wav          # 长滚动
  thunder-1300.wav     # 远雷
```

`build-envelope-data.py` 的三套模板直接对应上面三个文件名；换参考时需要同时改脚本顶部的 `TEMPLATES`。

## 典型用法

输出默认写到系统临时目录 `/tmp/sound-out`，可用 `--output` 指定其他目录。

```bash
# 1. 看参考结构
python3 tools/sound/measure.py <refs>/*.wav

# 2. 验证引擎能否临摹
python3 tools/sound/imitate.py <refs>/event-1.wav --output /tmp/sound-out

# 3. 渲染产品预设并验收
node tools/sound/render-presets.mjs --output /tmp/sound-out
python3 tools/sound/acceptance.py /tmp/sound-out/*.wav --references <refs>
HF_HUB_OFFLINE=1 python3 tools/sound/judge.py /tmp/sound-out/*.wav <refs>/event-1.wav

# 4. 改模板后重新生成产品数据
python3 tools/sound/build-envelope-data.py --references <refs> \
  --out src/views/ambience/models/thunderEnvelopes.ts
```

生成后运行 `pnpm format && pnpm check`。

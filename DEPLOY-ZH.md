# TASKFUSE 部署步骤

1. 在 GitHub 新建公开仓库 `taskfuse`，不要额外创建 README、License 或 `.gitignore`。
2. 上传本项目解压后的全部内容。
3. 在 Vercel 导入仓库，Root Directory 选择 `frontend`，Framework 选择 Vite。
4. 先部署预览版本。
5. 在 Remix 中新建 `TaskFuse.sol`，复制 `contracts/src/TaskFuse.sol` 的内容并编译。
6. 钱包切换到目标 EVM 网络，部署 `TaskFuse`；构造函数没有参数。
7. 复制合约地址，在 Vercel 添加 Config 环境变量：

```text
VITE_TASKFUSE_ADDRESS=0x完整合约地址
```

8. 重新部署 Production。

合约地址是公开信息，不需要设为 Secret。绝对不要上传钱包私钥。项目未经专业审计，请先用少量资金测试。


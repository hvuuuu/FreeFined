Optional local copies of the ONNX models. Model ids, upstream URLs and SHA-256 hashes live in
`shared/models/registry.json`; when a file here is missing, `app/api/models/[id]` proxies the
pinned upstream URL instead.

Download (all models, or only the ids you name):

```sh
pnpm models:install
pnpm models:install u2netp super-resolution-lite
```

module.exports = {
    files: [
      "./test/*"
    ],
    extensions: {
      "ts": "module"
    },
    nodeArguments: [
      "--loader=ts-node/esm",
      "--experimental-specifier-resolution=node"
    ]
}
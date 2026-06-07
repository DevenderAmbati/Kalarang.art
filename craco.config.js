module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const minimizers = webpackConfig.optimization?.minimizer ?? [];
      for (const plugin of minimizers) {
        if (plugin.options?.terserOptions) {
          plugin.options.terserOptions = {
            ...plugin.options.terserOptions,
            compress: {
              ...plugin.options.terserOptions.compress,
              drop_console: true,
            },
          };
          break;
        }
      }
      return webpackConfig;
    },
  },
};

module.exports = (config) => [
    require("stylelint")(),
    require("postcss-cssnext")({
      browsers: "last 2 versions",
      features: {
        customProperties: {
          variables: {
            maxWidth: "60rem",
            //colorPrimayDark: "#107491",
            colorPrimaryDark: "#936911",
            //colorPrimary: "#007acc",
            colorPrimary: "#D0A648",
            //colorSecondaryDark: "#22846C",
            colorSecondaryDark: "#5F5F5F",
            //colorSecondary: "#46BE77",
            colorSecondary: "#B6B6B6",
            colorNeutralDark: "#111",
            colorNeutral: "#8C8D91",
            colorNeutralLight: "#FBFCFC",
            colorText: "#555",
          },
        },
      },
    }),
    require("postcss-reporter")(),
    ...!config.production ? [
      require("postcss-browser-reporter")(),
    ] : [],
  ]

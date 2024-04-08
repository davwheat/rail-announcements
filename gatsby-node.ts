import path from 'path'
import { GatsbyNode } from 'gatsby'

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] = ({ stage, rules, loaders, plugins, actions }) => {
  if (stage === 'build-html' || stage === 'develop-html') {
    actions.setWebpackConfig({
      module: {
        rules: [
          {
            test: /crunker/,
            use: loaders.null(),
          },
        ],
      },
    })
  }

  actions.setWebpackConfig({
    module: {
      rules: [
        {
          test: /.jsonc$/,
          use: [
            {
              loader: `jsonc-loader`,
            },
          ],
        },
      ],
    },
    resolve: {
      alias: {
        '@components': path.resolve(__dirname, 'src/components'),
        '@data': path.resolve(__dirname, 'src/data'),
        '@atoms': path.resolve(__dirname, 'src/atoms'),
        '@helpers': path.resolve(__dirname, 'src/helpers'),
        '@announcement-data': path.resolve(__dirname, 'src/announcement-data'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@assets': path.resolve(__dirname, 'src/assets'),
      },
    },
  })
}

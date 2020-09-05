import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-LCDKH73MHQ"></script>
        <script async src="/gtag.js"></script>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

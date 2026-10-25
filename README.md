# サンプル（プロダクト名）

[![IMAGE ALT TEXT HERE](https://jphacks.com/wp-content/uploads/2026/07/IMG_5316.png)](https://www.youtube.com/watch?v=piaNsc6ilBI)

## 開発ドキュメント

- [アプリの起動・構成・モックデータの変更方法](docs/app-foundation.md)
- [ハードウェア側の制作予定](docs/plan.md)

## 製品概要

部屋のカビは、気がつかないうちに生えてしまいがちです。我々はこの課題に対し、ユーザーの意識を自然とカビに向け、カビ予防行動を促すアプリ「hogehoge」を作りました。
部屋の湿度・温度からカビ指数を算出し、マスコットを用いて可愛く可視化することで、一目でカビの進行度を確認することができます。

### 背景（製品開発のきっかけ、課題等）

メンバーの1人の体験がきっかけです。学生寮に入居した際、部屋に初めからカビがうっすら生えていました。その時はあまり気に留めていませんでしたが、しばらくするとカビが悪化してしまいました。
学生寮やアパートのような複数人が入居する環境では特に、自分だけでなく今後入居する人も快適に過ごせるように、カビ予防に対する意識を高め、カビの発生を予防することが重要であると考え、本プロダクトを考案しました。

### 製品説明（具体的な製品の説明）
### 特長
#### 1. 特長1
#### 2. 特長2
#### 3. 特長3

### 解決出来ること
### 今後の展望
### 注力したこと（こだわり等）
* 
* 

## 開発技術
### 活用した技術
#### API・データ

* なし？
* 

#### フレームワーク・ライブラリ・モジュール

* React Native
* Expo

#### デバイス

* ESP32
* 温湿度センサー

### 独自技術
#### ハッカソンで開発した独自機能・技術

* 論文を元に独自の改良を加えた、カビの進行度を推定する数理モデル
  * commit: [a1677c6](https://github.com/jphacks/tkb_2614/commit/a1677c68657ecc2ef9d2171393964e1b49d1df19), [38670d5](https://github.com/jphacks/tkb_2614/commit/38670d5d8e7c0c28340533c5875e9e2beb71fe8d)
  * 参考にした論文: Ojanen et al. (2010), [Mold Growth Modeling of Building Structures Using Sensitivity Classes of Materials](https://web.ornl.gov/sci/buildings/conf-archive/2010%20B11%20papers/104_Ojanen.pdf)

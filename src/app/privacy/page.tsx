import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | TalkGen',
  description: 'TalkGen（トーク生成ツール）のプライバシーポリシーです。',
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-8">プライバシーポリシー</h1>

      <p className="text-gray-300 text-sm leading-relaxed">
        TalkGen（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報を適切に取り扱います。
        本ポリシーは、本サービスが収集する情報とその利用方法について説明します。
      </p>

      {/* 1 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">1. 収集する情報</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスは、サービス提供のために以下の情報を収集します。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>
            <span className="font-medium text-gray-200">メールアドレス</span>
            ：アカウント登録・ログイン認証に使用します。
          </li>
          <li>
            <span className="font-medium text-gray-200">利用履歴</span>
            ：生成した台本の履歴・生成日時・利用回数など、サービス利用に関するデータ。
          </li>
          <li>
            <span className="font-medium text-gray-200">お気に入りデータ</span>
            ：ユーザーが保存したトピック・台本データ。
          </li>
          <li>
            <span className="font-medium text-gray-200">IPアドレス</span>
            ：不正アクセス検知・セキュリティ管理のために自動的に収集されます。
          </li>
          <li>
            <span className="font-medium text-gray-200">生成リクエスト内容</span>
            ：ユーザーが入力したトピック・キーワード・生成設定等のパラメータ。
            これらはOpenAI APIへのリクエストに使用されます（後述）。
          </li>
        </ul>
      </section>

      {/* 2 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">2. 情報の利用目的</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          収集した情報は、以下の目的でのみ利用します。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>本サービスの提供・運営（認証、生成処理、履歴管理）</li>
          <li>サービスの品質向上・機能改善のための利用状況分析</li>
          <li>不正利用・スパム・セキュリティ脅威の検知と防止</li>
          <li>利用統計の集計（個人を特定しない形での集計分析）</li>
          <li>重要なサービス変更・障害情報等のユーザーへの通知</li>
        </ul>
      </section>

      {/* 3 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">3. 第三者への情報提供</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>
            <span className="font-medium text-gray-200">法令に基づく場合</span>
            ：裁判所・警察・その他法的権限を有する機関からの適法な要請があった場合。
          </li>
          <li>
            <span className="font-medium text-gray-200">OpenAI APIへのリクエスト送信</span>
            ：台本生成のために、ユーザーが入力したトピック・生成パラメータをOpenAI, Inc.のAPIへ送信します。
            OpenAIによるデータの取り扱いはOpenAIのプライバシーポリシーに従います。
          </li>
        </ul>
        <p className="text-gray-300 text-sm leading-relaxed mt-3">
          上記以外の目的で第三者に個人情報を提供する場合は、事前にユーザーの同意を得ます。
        </p>
      </section>

      {/* 4 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">4. データの保存</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          アカウントデータ・利用履歴・お気に入りは、Supabase（PostgreSQL）に保存されます。
          ゲストモードおよびブラウザ側のキャッシュには、ブラウザのLocalStorageを使用します。
          通信はすべてSSL/TLS暗号化を通じて行われます。
          生成処理中の一時データ（プロンプト・レスポンス）はサーバーメモリ上に短時間保持されますが、処理完了後に破棄されます。永続的なログとして保存されることはありません。
        </p>
      </section>

      {/* 5 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">5. Cookieおよびローカルストレージについて</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスは、ブラウザのLocalStorageおよびセッションCookieを使用します。これらは以下の目的で利用されます。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>
            <span className="font-medium text-gray-200">認証状態の維持</span>
            ：ログインセッションを保持し、ページ遷移後も認証状態を維持します。
          </li>
          <li>
            <span className="font-medium text-gray-200">設定の保存</span>
            ：UIの設定状態（サイドバーの表示設定など）をブラウザに保存します。
          </li>
          <li>
            <span className="font-medium text-gray-200">生成結果のキャッシュ</span>
            ：同一パラメータでの重複リクエストを削減するための一時キャッシュ。
          </li>
        </ul>
        <p className="text-gray-300 text-sm leading-relaxed mt-3">
          ブラウザの設定によりLocalStorageを無効にすることは可能ですが、その場合、一部機能が正常に動作しないことがあります。
        </p>
      </section>

      {/* 6 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">6. ユーザーの権利</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          ユーザーは、本サービスが保有する自身の個人情報について以下の権利を有します。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>
            <span className="font-medium text-gray-200">開示請求</span>
            ：保有している個人情報の内容について確認を求める権利。
          </li>
          <li>
            <span className="font-medium text-gray-200">訂正</span>
            ：情報に誤りがある場合に訂正を求める権利。
          </li>
          <li>
            <span className="font-medium text-gray-200">削除</span>
            ：アカウントおよび関連データの削除を求める権利。
          </li>
        </ul>
        <p className="text-gray-300 text-sm leading-relaxed mt-3">
          これらの権利を行使する場合は、下記のお問い合わせ先までご連絡ください。
        </p>
      </section>

      {/* 7 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">7. セキュリティ</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスは以下のセキュリティ対策を実施しています。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>
            <span className="font-medium text-gray-200">SSL/TLS暗号化</span>
            ：すべての通信を暗号化し、データの盗聴・改ざんを防止します。
          </li>
          <li>
            <span className="font-medium text-gray-200">Row Level Security（RLS）</span>
            ：データベースレベルでユーザーごとのデータ分離を強制します。他ユーザーのデータには原則アクセスできません。
          </li>
          <li>
            <span className="font-medium text-gray-200">APIキー管理</span>
            ：OpenAI APIキー等の機密情報はサーバーサイドの環境変数で管理し、クライアントに露出しません。
          </li>
        </ul>
        <p className="text-gray-300 text-sm leading-relaxed mt-3">
          ただし、インターネット上の通信において完全な安全性を保証することはできません。セキュリティ上の問題を発見した場合は、速やかにお問い合わせください。
        </p>
      </section>

      {/* 8 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">8. ポリシーの改定</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本ポリシーは、法令の変更やサービスの改善に伴い更新されることがあります。
          変更後のポリシーは本ページに掲載した時点で効力を生じます。
          重要な変更については、サービス内での告知等によりユーザーへの周知に努めます。
        </p>
      </section>

      {/* 9 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">9. お問い合わせ</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          個人情報の取り扱いに関するお問い合わせ・開示請求・削除依頼は、以下のメールアドレスまでご連絡ください。
        </p>
        <p className="text-gray-300 text-sm leading-relaxed mt-2">
          メールアドレス：
          <a
            href="mailto:info@talkgen.app"
            className="text-blue-400 hover:text-blue-300 transition-colors ml-1"
          >
            info@talkgen.app
          </a>
        </p>
      </section>

      {/* 関連リンク */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <p className="text-gray-300 text-sm leading-relaxed">
          サービスの利用条件については
          <Link href="/terms" className="text-blue-400 hover:text-blue-300 transition-colors mx-1">
            利用規約
          </Link>
          をご確認ください。
        </p>
      </div>

      {/* 最終更新日 */}
      <p className="mt-6 text-xs text-gray-600">最終更新日：2026年3月12日</p>
    </div>
  );
}

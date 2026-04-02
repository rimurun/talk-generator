import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '利用規約 | TalkGen',
  description: 'TalkGen（トーク生成ツール）の利用規約です。',
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-8">利用規約</h1>

      {/* 第1条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第1条（本サービスについて）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          TalkGen（以下「本サービス」）は、配信・動画制作向けの台本・トークスクリプトをAIを用いて自動生成するウェブサービスです。
          本サービスのAI生成機能はOpenAI, Inc.が提供するAPIを利用しています。
          本規約は、本サービスを利用するすべてのユーザー（以下「ユーザー」）に適用されます。
          本サービスを利用することで、ユーザーは本規約に同意したものとみなします。
        </p>
      </section>

      {/* 第2条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第2条（アカウント）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスは、メールアドレスによる認証を経たログインアカウントと、アカウント登録不要のゲストモードの両方を提供します。
          アカウント登録の際は、正確な情報を入力してください。虚偽の情報による登録は禁止します。
          ユーザーはアカウントの認証情報（メールアドレス・パスワード）を自己の責任で管理し、第三者に譲渡・共有してはなりません。
          不正アクセスや認証情報の漏洩を発見した場合は、速やかに運営者へ連絡してください。
        </p>
      </section>

      {/* 第3条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第3条（利用制限）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスでは、サービスの安定運用のためにアカウント種別ごとに1日あたりの台本生成回数に上限を設けています。
          上限はサービスの状況に応じて変更される場合があります。
          以下の行為は禁止します。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>スクリプトやボット等を用いた自動アクセス・大量リクエスト</li>
          <li>本サービスのAPIエンドポイントへの直接呼び出し（フロントエンドUIを経由しないアクセス）</li>
          <li>複数アカウントを作成して利用制限を回避する行為</li>
          <li>不正な手段によるサービスへのアクセス</li>
        </ul>
      </section>

      {/* 第4条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第4条（生成コンテンツ）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本サービスが生成するテキストはAIによるものであり、その正確性・完全性・最新性・適法性を運営者は保証しません。
          生成されたコンテンツをユーザーが実際の配信・動画・その他用途に使用する場合は、内容の確認・修正をユーザー自身の責任で行ってください。
          ユーザーが入力したプロンプトに基づいて生成されたコンテンツの著作権は、法令の範囲内においてユーザーに帰属します。
          ただし、AIが学習データに含まれる既存著作物と類似したコンテンツを生成した場合の権利関係については、ユーザー自身が判断・確認する責任を負います。
        </p>
      </section>

      {/* 第5条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第5条（禁止事項）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          ユーザーは本サービスを利用するにあたり、以下の行為を行ってはなりません。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>法令または公序良俗に違反する内容の生成・利用</li>
          <li>他者の著作権、商標権、肖像権、プライバシー権その他の権利を侵害する行為</li>
          <li>誹謗中傷、差別的表現、ハラスメントに該当するコンテンツの生成</li>
          <li>本サービスのサーバーやネットワークに過度な負荷をかける行為</li>
          <li>本サービスのリバースエンジニアリング、逆コンパイル、ソースコードの解析</li>
          <li>本サービスを利用した商業的スパム、フィッシング、詐欺的行為</li>
          <li>その他、運営者が不適切と判断する行為</li>
        </ul>
      </section>

      {/* 第6条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第6条（免責事項）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          運営者は以下の事項について、法令上認められる最大限の範囲で責任を負いません。
        </p>
        <ul className="text-gray-300 text-sm leading-relaxed mt-2 list-disc list-inside space-y-1">
          <li>システムメンテナンス、障害、第三者サービスの停止等によるサービスの中断・停止</li>
          <li>ユーザーが保存・生成したデータの損失・消失</li>
          <li>AIが生成したコンテンツの正確性・適法性・品質に起因する損害</li>
          <li>ユーザーが本サービスのコンテンツを利用したことにより生じた第三者との紛争</li>
          <li>ユーザーの機器・通信環境に起因するトラブル</li>
        </ul>
      </section>

      {/* 第7条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第7条（サービスの変更・終了）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          運営者は、事前の通知なく本サービスの内容を変更、または提供を終了することがあります。
          機能の追加・削除・仕様変更についても同様です。
          サービス終了に伴うユーザーデータの取り扱いについては、終了時に別途案内します。
          運営者はサービス変更・終了によってユーザーに生じた損害について、故意または重大な過失がない限り責任を負いません。
        </p>
      </section>

      {/* 第8条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第8条（規約の変更）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          運営者は必要に応じて本規約を変更することがあります。
          変更後の規約は本ページに掲載した時点で効力を生じ、ユーザーが変更後も本サービスを継続して利用した場合、変更後の規約に同意したものとみなします。
          重要な変更については、サービス内での告知等によりユーザーへの周知に努めますが、通知を保証するものではありません。
        </p>
      </section>

      {/* 第9条 */}
      <section>
        <h2 className="text-lg font-semibold text-white mt-8 mb-3">第9条（準拠法・管轄裁判所）</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          本規約の解釈および適用は日本法に準拠します。
          本サービスに関してユーザーと運営者の間で紛争が生じた場合、運営者の所在地を管轄する日本の裁判所を専属的合意管轄裁判所とします。
        </p>
      </section>

      {/* 関連リンク */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <p className="text-gray-300 text-sm leading-relaxed">
          個人情報の取り扱いについては
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors mx-1">
            プライバシーポリシー
          </Link>
          をご確認ください。
        </p>
      </div>

      {/* 最終更新日 */}
      <p className="mt-6 text-xs text-gray-600">最終更新日：2026年3月12日</p>
    </div>
  );
}

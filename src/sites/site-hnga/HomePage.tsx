/**
 * site-hnga HomePage —— 湖南省公安厅门户首页（路由根 / ""）。
 *
 * 数据来源：page-hnga（含举报中心文案 + 举报电话 callout）。
 * 页面 JSON blocks 的渲染是权威内容；政务首页外围框架（公告条、
 * 侧边快速入口、联系电话、热点专题）在本站静态补足，使站点
 * "像真实公安厅门户"，但举报电话 0731-88888888 严格来自 page JSON 的 callout，
 * 页面静态处也再次展示作为页脚联系电话（与 page JSON 一致）。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import Layout, { SideBlock } from './Layout'
import { BlockList } from './blocks'

const PAGE_ID = 'page-hnga'
const REPORT_PHONE = '0731-88888888' // 与 page-hnga.json callout 一致；静态处展示用

export default function HomePage(): JSX.Element {
  const [page, setPage] = useState<SitePage | null>(null)
  const base = useSiteBase()

  useEffect(() => {
    void getPageContent(PAGE_ID).then(setPage)
  }, [])

  return (
    <Layout
      activePath=""
      breadcrumb={
        <>
          <Link to={sitePath(base, '')}>首页</Link>
          <span className="hnga-sep">{'>'}</span>
          <span>门户首页</span>
        </>
      }
      sidebar={<Sidebar />}
    >
      {/* 举报中心横幅：醒目展示举报电话。电话号码也由 page JSON 的 callout 给出。 */}
      <section className="hnga-report-banner" aria-label="举报中心">
        <p className="hnga-report-banner-label">湖南公安机关 举报中心</p>
        <h2 className="hnga-report-banner-title">违法犯罪线索举报</h2>
        <p className="hnga-report-banner-label">
          受理各类违法犯罪线索举报，保护人民群众生命财产安全。
        </p>
        <div className="hnga-report-phone">
          <span className="hnga-report-phone-label">举报电话</span>
          <span className="hnga-report-phone-num">{REPORT_PHONE}</span>
        </div>
        <p className="hnga-report-note">
          工作时间：工作日 8:00-20:00　|　非工作时间自动录音接听
        </p>
      </section>

      {/* 公告条 */}
      <div className="hnga-notice-strip">
        <strong>【公告】</strong>
        <span>
          为进一步方便群众举报违法犯罪线索，湖南省公安厅举报中心
          <strong> {REPORT_PHONE} </strong>
          全天候受理，对举报人信息严格保密。
        </span>
      </div>

      {/* page JSON 内容（权威：举报中心标题 + 受理说明 + 举报电话 callout） */}
      <section className="hnga-card">
        <div className="hnga-card-head">
          <h3 className="hnga-card-title">举报中心详情</h3>
          <Link to={sitePath(base, 'report')} className="hnga-card-more">
            更多 {'>'}
          </Link>
        </div>
        <div className="hnga-card-body">
          {page ? (
            <BlockList blocks={page.blocks} />
          ) : (
            <div className="hnga-loading">内容加载中…</div>
          )}
        </div>
      </section>

      {/* 首页静态：警务要闻（占位框架，政务门户必有板块） */}
      <section className="hnga-card">
        <div className="hnga-card-head">
          <h3 className="hnga-card-title">警务要闻</h3>
          <Link to={sitePath(base, 'open')} className="hnga-card-more">
            更多 {'>'}
          </Link>
        </div>
        <div className="hnga-card-body">
          <ul className="hnga-articlelist">
            <li>
              <Link to={sitePath(base, 'open')}>全省公安机关夏季治安打击整治行动取得阶段性成效</Link>
              <span className="hnga-articlelist-date">2026-08-12</span>
            </li>
            <li>
              <Link to={sitePath(base, 'open')}>省公安厅召开专题会议部署打击治理电信网络诈骗工作</Link>
              <span className="hnga-articlelist-date">2026-08-05</span>
            </li>
            <li>
              <Link to={sitePath(base, 'open')}>深化警务机制改革 持续优化营商环境</Link>
              <span className="hnga-articlelist-date">2026-07-28</span>
            </li>
            <li>
              <Link to={sitePath(base, 'open')}>深入推进禁毒"清源断流"专项行动</Link>
              <span className="hnga-articlelist-date">2026-07-15</span>
            </li>
          </ul>
        </div>
      </section>
    </Layout>
  )
}

/** 右侧栏：快速举报 + 办事入口 + 联系方式。 */
function Sidebar(): JSX.Element {
  const base = useSiteBase()
  return (
    <>
      <SideBlock title="快速举报">
        <div className="hnga-contact-line">
          举报电话
          <span className="hnga-contact-phone">{REPORT_PHONE}</span>
          欢迎广大群众如实举报违法犯罪线索，公安机关将对举报人信息严格保密。
        </div>
      </SideBlock>

      <SideBlock title="办事服务">
        <ul className="hnga-quicklist">
          <li>
            <Link to={sitePath(base, 'service')}>
              户籍办理<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
          <li>
            <Link to={sitePath(base, 'service')}>
              出入境服务<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
          <li>
            <Link to={sitePath(base, 'service')}>
              交管业务<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
          <li>
            <Link to={sitePath(base, 'service')}>
              网上办事大厅<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
        </ul>
      </SideBlock>

      <SideBlock title="警民互动">
        <ul className="hnga-quicklist">
          <li>
            <Link to={sitePath(base, 'interact')}>
              厅长信箱<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
          <li>
            <Link to={sitePath(base, 'interact')}>
              在线咨询<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
          <li>
            <Link to={sitePath(base, 'interact')}>
              举报投诉<span className="hnga-quicklist-date">{'>'}</span>
            </Link>
          </li>
        </ul>
      </SideBlock>
    </>
  )
}

/**
 * site-hnga SectionPage —— 站内子板块占位页。
 *
 * 本站 page JSON 仅 page-hnga 一页；主导航的"机构概况/警务公开/举报中心/
 * 办事服务/警民互动/信息公开"等栏目在数据层无对应内容页。为使站点作为
 * 真实政务门户在站内导航上自洽，这些栏目统一渲染为本占位页：
 * 说明该板块正在完善 + 引导前往举报中心（本站核心板块）。
 *
 * 不伪造任何本应来自 page JSON 的内容，避免与数据契约冲突。
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import Layout from './Layout'

const SECTIONS: Record<string, { title: string; desc: string }> = {
  intro: {
    title: '机构概况',
    desc: '湖南省公安厅机构设置、领导介绍、主要职责等概况信息正在完善中。',
  },
  open: {
    title: '警务公开',
    desc: '警务公开栏目正在完善中，近期警务要闻可返回首页查看。',
  },
  report: {
    title: '举报中心',
    desc: '违法犯罪线索举报请拨打举报电话。详情见首页举报中心横幅。',
  },
  service: {
    title: '办事服务',
    desc: '户籍、出入境、交管等网上办事服务正在完善中。',
  },
  interact: {
    title: '警民互动',
    desc: '厅长信箱、在线咨询、举报投诉等互动渠道正在完善中。',
  },
  disclose: {
    title: '信息公开',
    desc: '政府信息公开专栏正在完善中。',
  },
}

export default function SectionPage({ section }: { section: string }): JSX.Element {
  const base = useSiteBase()
  const meta = SECTIONS[section] ?? {
    title: '栏目',
    desc: '您访问的栏目正在完善中。',
  }

  return (
    <Layout
      activePath={section}
      singleColumn
      breadcrumb={
        <>
          <Link to={sitePath(base, '')}>首页</Link>
          <span className="hnga-sep">{'>'}</span>
          <span>{meta.title}</span>
        </>
      }
    >
      <section className="hnga-card">
        <div className="hnga-card-head">
          <h3 className="hnga-card-title">{meta.title}</h3>
        </div>
        <div className="hnga-card-body">
          <p className="hnga-paragraph hnga-paragraph-plain">{meta.desc}</p>

          {section === 'report' ? (
            <ReportHighlight />
          ) : (
            <p className="hnga-paragraph hnga-paragraph-plain">
              如需举报违法犯罪线索，请前往
              <Link to={sitePath(base, 'report')} style={{ color: '#b01d26', margin: '0 4px' }}>
                举报中心
              </Link>
              ，或直接拨打举报电话 0731-88888888。
            </p>
          )}

          <p className="hnga-paragraph hnga-paragraph-plain" style={{ marginTop: 24 }}>
            <Link to={sitePath(base, '')}>{'<'} 返回首页</Link>
          </p>
        </div>
      </section>
    </Layout>
  )
}

/** 举报中心板块的强提示区。电话与首页横幅一致。 */
function ReportHighlight(): ReactNode {
  return (
    <>
      <div className="hnga-report-banner" style={{ marginTop: 16 }}>
        <p className="hnga-report-banner-label">湖南公安机关 举报中心</p>
        <h2 className="hnga-report-banner-title">违法犯罪线索举报</h2>
        <div className="hnga-report-phone">
          <span className="hnga-report-phone-label">举报电话</span>
          <span className="hnga-report-phone-num">0731-88888888</span>
        </div>
        <p className="hnga-report-note">
          工作时间：工作日 8:00-20:00　|　非工作时间自动录音接听　|　举报人信息严格保密
        </p>
      </div>
      <p className="hnga-paragraph hnga-paragraph-plain">
        受理违法犯罪线索举报。请如实反映情况，公安机关将依法核查处理。
      </p>
    </>
  )
}

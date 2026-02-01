import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'

const sections = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'information-we-collect', label: 'Information We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Information' },
  { id: 'data-sharing', label: 'Data Sharing' },
  { id: 'data-security', label: 'Data Security' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'cookies', label: 'Cookies and Tracking' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact Us' },
]

export function PrivacyPolicy() {
  const navigate = useNavigate()
  const { initTheme } = useAppStore()
  const [activeSection, setActiveSection] = useState('introduction')

  useEffect(() => {
    initTheme()
  }, [initTheme])

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => document.getElementById(s.id))
      const scrollPosition = window.scrollY + 120

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 80
      const elementPosition = element.offsetTop - offset
      window.scrollTo({ top: elementPosition, behavior: 'smooth' })
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-6xl px-6 py-12 lg:px-12">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 mb-10 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex gap-16">
          {/* Sidebar */}
          <aside className="hidden lg:block w-52 flex-shrink-0">
            <nav className="sticky top-12">
              <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">
                On this page
              </p>
              <div className="border-l border-neutral-200 dark:border-neutral-800">
                <ul className="space-y-0.5">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className={`block w-full text-left pl-4 py-1.5 text-[13px] transition-colors -ml-px border-l ${activeSection === section.id
                          ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                          : 'border-transparent text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                          }`}
                      >
                        {section.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            <article>
              <h1 className="text-3xl font-semibold text-neutral-900 dark:text-white mb-1">Privacy Policy</h1>
              <p className="text-neutral-400 dark:text-neutral-500 text-sm mb-10">Last updated: December 27, 2024</p>

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
                <section id="introduction" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">1. Introduction</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    G-Note AI ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our note-taking application available at gnoteai.com and our Chrome extension.
                  </p>
                </section>

                <section id="information-we-collect" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">2. Information We Collect</h2>

                  <h3 className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200 mb-2 mt-6">2.1 Account Information</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    When you sign in with Google, we receive your basic profile information including your name, email address, and profile picture. This information is used solely for authentication and displaying your account details within the app.
                  </p>

                  <h3 className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200 mb-2 mt-6">2.2 Notes and Content</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    Your notes, including text, images, and drawings, are stored in your personal Google Drive account. We do not store your note content on our servers. All synchronization happens directly between your device and Google Drive using your authorized access.
                  </p>

                  <h3 className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200 mb-2 mt-6">2.3 Local Storage</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    For offline functionality, your notes are temporarily cached in your browser's local storage (IndexedDB). This data remains on your device and is synchronized with Google Drive when you're online.
                  </p>

                  <h3 className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200 mb-2 mt-6">2.4 AI Features</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    When you use AI features (summarize, improve writing, translate, extract tasks, or chat), your note content is sent to our AI service provider for processing. This data is used only to generate the requested output and is not stored or used for training purposes.
                  </p>
                </section>

                <section id="how-we-use" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">3. How We Use Your Information</h2>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>To authenticate your identity and provide access to the application</li>
                    <li>To synchronize your notes with Google Drive</li>
                    <li>To enable sharing and collaboration features</li>
                    <li>To provide AI-powered writing assistance</li>
                    <li>To improve our services and user experience</li>
                  </ul>
                </section>

                <section id="data-sharing" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">4. Data Sharing</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    We do not sell, trade, or rent your personal information to third parties. Your data may be shared only in the following circumstances:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li><span className="text-neutral-700 dark:text-neutral-300">Google Drive:</span> Your notes are stored in your Google Drive account</li>
                    <li><span className="text-neutral-700 dark:text-neutral-300">AI Processing:</span> Note content is processed by our AI service when you use AI features</li>
                    <li><span className="text-neutral-700 dark:text-neutral-300">Sharing Features:</span> When you choose to share a note publicly or with specific users</li>
                    <li><span className="text-neutral-700 dark:text-neutral-300">Legal Requirements:</span> When required by law or to protect our rights</li>
                  </ul>
                </section>

                <section id="data-security" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">5. Data Security</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    We implement industry-standard security measures to protect your information. All data transmission is encrypted using HTTPS. Your Google authentication tokens are securely stored and automatically refreshed. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                  </p>
                </section>

                <section id="your-rights" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">6. Your Rights</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">You have the right to:</p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>Access your personal data stored in Google Drive</li>
                    <li>Delete your notes and account data at any time</li>
                    <li>Revoke G-Note AI's access to your Google account through Google's security settings</li>
                    <li>Export your notes in various formats (PDF, Word, HTML, Markdown)</li>
                  </ul>
                </section>

                <section id="cookies" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">7. Cookies and Tracking</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    G-Note AI uses essential cookies and local storage for authentication and app functionality. We do not use tracking cookies or third-party analytics that collect personal information.
                  </p>
                </section>

                <section id="children" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">8. Children's Privacy</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    G-Note AI is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
                  </p>
                </section>

                <section id="changes" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">9. Changes to This Policy</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                  </p>
                </section>

                <section id="contact" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">10. Contact Us</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    If you have any questions about this Privacy Policy, please contact us at:{' '}
                    <a href="mailto:Support@gnoteai.com" className="text-neutral-900 dark:text-neutral-100 underline underline-offset-2">
                      Support@gnoteai.com
                    </a>
                  </p>
                </section>
              </div>
            </article>
          </main>
        </div>
      </div>
    </div>
  )
}

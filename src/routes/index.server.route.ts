import { homeController } from '../controllers/home.controller'
import { Express } from 'express'
import { indexController } from '../controllers/index.controller'
import { userProfileController } from '../controllers/user/user.profile.controller'
import { userDashboardController } from '../controllers/user/user.dashboard.controller'
import { userCommonController } from '../controllers/user/user.common.controller'
import { userVpsController } from '../controllers/user/user.vps.controller'
import { userLicenseController } from '../controllers/user/user.license.controller'
import { userAcademyController } from '../controllers/user/user.academy.controller'
import { userMarketingController } from '../controllers/user/user.marketing.controller'
import { userWalletController } from '../controllers/user/user.wallet.controller'
import { userPaymentController } from '../controllers/user/user.payment.controller'
import { userVerificationController } from '../controllers/user/user.verification.controller'
import { userPayController } from '../controllers/user/user.pay.controller'
import { userTeamController } from '../controllers/user/user.team.controller'
import { userTicketController } from '../controllers/user/user.ticket.controller'
import { adminCommonController } from '../controllers/admin/admin.common.controller'
import { adminUserController } from '../controllers/admin/admin.user.controller'
import { adminLicenseController } from '../controllers/admin/admin.license.controller'
import { adminPaymentController } from '../controllers/admin/admin.payment.controller'
import { adminWithdrawController } from '../controllers/admin/admin.withdraw.controller'
import { adminTicketController } from '../controllers/admin/admin.ticket.controller'
import { adminFeedController } from '../controllers/admin/admin.feed.controller'
import { adminAnnouncementController } from '../controllers/admin/admin.announcement.controller'
import { adminStatsController } from '../controllers/admin/admin.stats.controller'
import { adminTeamController } from '../controllers/admin/admin.team.controller'
import { userTestController } from '../controllers/user/user.test.controller'
import { adminRankController } from '../controllers/admin/admin.rank.controller'
import { adminCouponController } from '../controllers/admin/admin.coupon.controller'
export default class IndexRoute {
  constructor(app: Express) {
    app.get('/', indexController.index)
    app.get('/test', indexController.test)
    app.get('/index/license', indexController.license)


    ///////////////////////////////////admin side//////////////////////////////////////////
    app.get('/admin/get-profile-info', adminCommonController.getProfileInfo)
    app.post('/admin/update-profile-info', adminCommonController.updateProfileInfo)
    app.get('/admin/users/get-data-list', adminUserController.getDataList)
    app.post('/admin/users/set-tmp-password', adminUserController.setTmpPassword)
    app.post('/admin/users/update-user-info', adminUserController.updateUserInfo)
    app.post('/admin/users/update-user-status', adminUserController.changeStatus)
    app.get('/admin/licenses/get-data-list', adminLicenseController.getDataList)
    app.get('/admin/payments/get-data-list', adminPaymentController.getDataList)
    app.post('/admin/payments/delete-item', adminPaymentController.deleteItem)
    app.get('/admin/withdraw/get-data-list', adminWithdrawController.getDataList)
    app.post('/admin/withdraw/change-status', adminWithdrawController.changeStatus)
    app.get('/admin/ticket/get-data-list', adminTicketController.getDataList)
    app.get('/admin/ticket/get-info-page-detail', adminTicketController.getInfoPageDetail)
    app.post('/admin/ticket/submit-ticket-message', adminTicketController.submitTicketMessage)
    app.get('/admin/feed/get-data-list', adminFeedController.getDataList)
    app.get('/admin/feed/get-info-page-detail', adminFeedController.getInfoPageDetail)
    app.post('/admin/feed/submit-feed', adminFeedController.submitFeed)
    app.post('/admin/feed/delete-feed', adminFeedController.deleteFeed)
    app.post('/admin/announcement/submit', adminAnnouncementController.submitData)
    app.get('/admin/stats/get-page-detail', adminStatsController.getPageDetail)
    app.get('/admin/team/get-page-detail', adminTeamController.getPageDetail)
    //app.get('/admin/users/download', adminUserController.Download)
    app.post('/admin/users/download', adminUserController.Download)
    app.get('/admin/rank/get-page-detail', adminRankController.getPageDetail)
    app.get('/admin/team/get-uplevel-user', adminTeamController.getUpLevelUser)

    app.get('/admin/coupon/get-data-list', adminCouponController.getDataList)
    app.get('/admin/coupon/get-info', adminCouponController.getInfo)
    app.post('/admin/coupon/submit-coupon', adminCouponController.submitCoupon)
    app.post('/admin/coupon/delete-coupon', adminCouponController.deleteCoupon)

    ///////////////////////////////////home side///////////////////////////////////////////
    app.get('/app-setting', homeController.get_app_settings)
    app.post('/register', homeController.register)
    app.post('/send-auth-sms', homeController.sendAuthSms)
    app.post('/check-auth-sms', homeController.checkAuthSms)
    app.post('/login', homeController.login)
    app.post('/login-two-fact-auth', homeController.loginTwoFactAuth)
    app.post('/request-reset-password', homeController.requestResetPassword)
    app.get('/confirm-password', homeController.confirmPassword)
    app.get('/logout', homeController.logout)
    app.post('/guest-ticket', homeController.sendGuestTicket)
    app.post('/upload-image', homeController.fileUpload)
    app.post('/check-sponsor', homeController.checkSponsor)
    app.post('/check-password-strength', homeController.checkPasswordStrength)
    app.post('/check-coupon', homeController.checkCoupon)


    ///////////////////////////////////user side//////////////////////////////////////////
    app.get('/user/dashboard', userDashboardController.getData)
    app.get('/user/get-profile-info', userCommonController.getProfileInfo)
    app.get('/user/check-has-active-license', userCommonController.checkUserHasActiveLicense)
    app.post('/user/check-hlx-password', userCommonController.checkUserHlxPassword)
    app.post('/user/vps/get-vps-password', userVpsController.getVpsPassword)
    app.get('/user/vps/get-console-url', userVpsController.getConsoleUrl)
    app.get('/user/license/get-page-detail', userLicenseController.getPageDetail)
    app.post('/user/license/update-info', userLicenseController.updateDetail)
    app.get('/user/academy/get-page-detail', userAcademyController.getPageDetail)
    app.get('/user/academy/get-lesson-list', userAcademyController.getLessonList)
    app.get('/user/marketing/get-page-detail', userMarketingController.getPageDetail)
    app.get('/user/marketing/get-user-rank-detail', userMarketingController.getUserRankDetail)
    app.get('/user/wallet/get-page-detail', userWalletController.getPageDetail)
    app.post('/user/wallet/request-withdraw', userWalletController.requestWithdrawal)
    app.post('/user/wallet/delete-user-payout', userWalletController.deletePayout)
    app.post('/user/wallet/delete-user-withdrawal', userWalletController.deleteWithdrawal)
    app.get('/user/payment/get-page-detail', userPaymentController.getPageDetail)
    app.get('/user/profile/get-page-detail', userProfileController.getPageDetail)
    app.post('/user/profile/update-detail', userProfileController.updateDetail)
    app.post('/user/profile/update-card-detail', userProfileController.updateCardDetail)
    app.post('/user/profile/remove-card-detail', userProfileController.removeCardDetail)
    app.get('/user/profile/cancel-membership', userProfileController.cancelMembership)
    app.get('/user/profile/cancel-affiliate', userProfileController.cancelAffiliate)
    app.get('/user/verification/get-page-detail', userVerificationController.getPageDetail)
    app.get('/user/verification/send-verification-email', userVerificationController.sendVerificationEmail)
    app.get('/user/verification/confirm', userVerificationController.confirmVerificationCode)
    app.post('/user/verification/complete', userVerificationController.completeVerification)
    app.get('/user/verification/cancel', userVerificationController.cancelVerification)
    app.post('/user/verification/disable', userVerificationController.disableVerification)
    app.get('/user/pay/get-page-detail', userPayController.getPageDetail)
    app.post('/user/pay/license', userPayController.payLicense)
    app.post('/user/pay/affiliate', userPayController.payAffiliate)
    app.get('/user/team/get-page-detail', userTeamController.getPageDetail)
    app.get('/user/team/get-tank-list', userTeamController.getTankUserList)
    app.post('/user/team/assign-tank-user', userTeamController.assignChildUser)
    app.get('/user/ticket/get-list-page-detail', userTicketController.getListPageDetail)
    app.post('/user/ticket/submit-ticket', userTicketController.submitTicket)
    app.get('/user/ticket/get-info-page-detail', userTicketController.getInfoPageDetail)
    app.post('/user/ticket/submit-ticket-message', userTicketController.submitTicketMessage)
    app.post('/user/ticket/close-ticket', userTicketController.closeTicket)
    app.get('/user/marketing/get-data-list', userMarketingController.getDataList)
    app.get('/user/team/get-uplevel-user', userTeamController.getUpLevelUser)
    app.post('/user/payment/download-invoice', userPaymentController.downloadInvoice)



    ///////////////////////////////////for test (tmp)//////////////////////////////////////////
    app.get('/user/test/migrate-db-from-php', userTestController.migrate_db_from_php)
    app.get('/user/test/migrate-db-to-php', userTestController.migrate_db_to_php)
    app.get('/user/test/migrate-db-for-affiliate', userTestController.migrate_db_for_affiliate)
    app.get('/user/test/test_func', userTestController.test_func)

    ///////////////////////////////////for test (vps)//////////////////////////////////////////
    app.get('/user/test/create_vps_user', userTestController.test_create_vps_user)

    ///////////////////////////////////for test pdfkit//////////////////////////////////////////
    app.get('/user/test/create_pdf', userTestController.create_pdf)
    
  }
}


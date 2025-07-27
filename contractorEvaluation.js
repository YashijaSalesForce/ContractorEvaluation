import { LightningElement, track, api } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getProjectData from "@salesforce/apex/ContractorEvaluationController.getProjectData";
import submitEvaluation from "@salesforce/apex/ContractorEvaluationController.submitEvaluation";

export default class ContractorEvaluation extends LightningElement {
  @api recordId; // Experience Builder에서 자동으로 설정되는 recordId
  @track loading = false;
  @track isLoading = false;
  @track projectData = {};
  @track evaluationData = {
    workQuality: 0,
    timeliness: 0,
    communication: 0,
    costEffectiveness: 0,
    overallSatisfaction: 0
  };
  @track ratings = {
    workQuality: 0,
    finishing: 0,
    timeManagement: 0,
    communication: 0,
    serviceAttitude: 0,
    pricing: 0,
    overallSatisfaction: 0
  };
  @track comments = "";

  connectedCallback() {
    // recordId가 없으면 기본값 설정
    if (!this.recordId) {
      this.recordId = "001gK00000CdBPhQAN";
    }
    this.loadProjectData();
  }

  get hasValidProjectId() {
    return !!this.recordId;
  }

  async loadProjectData() {
    this.loading = true;
    this.isLoading = true;
    try {
      console.log("Loading project data for recordId:", this.recordId);
      const result = await getProjectData({ projectId: this.recordId });
      console.log("Project data loaded successfully:", result);
      this.projectData = result;
    } catch (error) {
      console.error("Error loading project data:", error);
      console.error("Error details:", JSON.stringify(error));
      this.showToast(
        "오류",
        "프로젝트 데이터를 불러오는 중 오류가 발생했습니다: " +
          (error.body?.message || error.message || "알 수 없는 오류"),
        "error"
      );
    } finally {
      this.loading = false;
      this.isLoading = false;
    }
  }

  handleStarClick(event) {
    const category = event.target.dataset.field; // data-field 사용
    const rating = parseInt(event.target.dataset.value); // data-value 사용

    if (category && rating) {
      this.ratings[category] = rating;
      this.evaluationData[category] = rating;
      this.updateStarDisplay(category, rating);

      // 별점 클릭 시 토스트 제거 (방해되지 않도록)
      // this.showToast(
      //   "평가 완료",
      //   `${this.getCategoryLabel(category)}: ${rating}점`,
      //   "success"
      // );
    }
  }

  updateStarDisplay(category, rating) {
    const stars = this.template.querySelectorAll(`[data-field="${category}"]`);
    stars.forEach((star, index) => {
      const starRating = index + 1;
      if (starRating <= rating) {
        star.classList.add("selected");
        star.style.color = "#FFD700 !important";
        star.style.backgroundColor = "#FFD700 !important";
      } else {
        star.classList.remove("selected");
        star.style.color = "#ddd !important";
        star.style.backgroundColor = "#ddd !important";
      }
    });
  }

  getCategoryLabel(category) {
    const labels = {
      workQuality: "작업 품질",
      timeliness: "일정 준수",
      communication: "의사소통",
      costEffectiveness: "비용 효율성",
      overallSatisfaction: "전반적 만족도"
    };
    return labels[category] || category;
  }

  handleCommentsChange(event) {
    this.comments = event.target.value;
  }

  async handleSubmit() {
    if (!this.validateRatings()) {
      this.showToast("입력 오류", "모든 항목에 대해 평가해주세요.", "error");
      return;
    }

    this.loading = true;
    try {
      // 안전한 값 계산
      const serviceAttitude = this.ratings.serviceAttitude || 0;
      const pricing = this.ratings.pricing || 0;
      const costEffectiveness = Math.round((serviceAttitude + pricing) / 2);

      console.log("Submitting evaluation with values:", {
        projectId: this.recordId,
        workQuality: this.ratings.workQuality,
        timeliness: this.ratings.finishing,
        communication: this.ratings.communication,
        costEffectiveness: costEffectiveness,
        overallSatisfaction: this.ratings.overallSatisfaction,
        comments: this.comments
      });

      await submitEvaluation({
        projectId: this.recordId,
        workQuality: this.ratings.workQuality,
        timeliness: this.ratings.finishing, // finishing -> timeliness 매핑
        communication: this.ratings.communication,
        costEffectiveness: costEffectiveness, // 서비스태도+가격 평균
        overallSatisfaction: this.ratings.overallSatisfaction,
        comments: this.comments
      });

      this.showToast("감사합니다", "평가가 완료되었습니다", "success");
      this.resetForm();
    } catch (error) {
      console.error("Submission error:", error);
      console.error("Error body:", error.body);
      this.showToast(
        "오류",
        "평가 제출 중 오류가 발생했습니다: " +
          (error.body?.message || error.message),
        "error"
      );
    } finally {
      this.loading = false;
    }
  }

  validateRatings() {
    // 실제 제출에 필요한 필드들만 검증
    const requiredFields = [
      "workQuality",
      "finishing", // timeliness로 매핑됨
      "communication",
      "serviceAttitude", // costEffectiveness 계산에 사용
      "pricing", // costEffectiveness 계산에 사용
      "overallSatisfaction"
    ];

    return requiredFields.every((field) => this.ratings[field] > 0);
  }

  resetForm() {
    this.ratings = {
      workQuality: 0,
      finishing: 0,
      timeManagement: 0,
      communication: 0,
      serviceAttitude: 0,
      pricing: 0,
      overallSatisfaction: 0
    };
    this.evaluationData = {
      workQuality: 0,
      finishing: 0,
      timeManagement: 0,
      communication: 0,
      serviceAttitude: 0,
      pricing: 0,
      overallSatisfaction: 0
    };
    this.comments = "";

    // 별점 디스플레이 초기화
    const allStars = this.template.querySelectorAll(".star-rating button");
    allStars.forEach((star) => {
      star.style.color = "#ddd";
      star.style.backgroundColor = "#ddd";
    });
  }

  // 시공사 정보 getter 메소드들
  get contractorInfo() {
    // Apex에서 vendorName을 Description 필드에 임시로 저장했으므로 이를 사용
    const vendorName = this.projectData?.Contractor_Account__r?.Description;
    const accountName = this.projectData?.Contractor_Account__r?.Name;

    // vendorName이 있으면 사용, 없으면 Account Name 사용
    if (vendorName && vendorName.trim() !== "") {
      return vendorName;
    } else if (accountName && accountName.trim() !== "") {
      return accountName;
    } else {
      return "정보 없음";
    }
  }

  get contractorPhone() {
    return this.projectData?.Contractor_Account__r?.Phone || "정보 없음";
  }

  get contractorAddress() {
    return (
      this.projectData?.Contractor_Account__r?.Account_BillingStreet__c ||
      "정보 없음"
    );
  }

  showToast(title, message, variant) {
    const event = new ShowToastEvent({
      title: title,
      message: message,
      variant: variant,
      mode: "dismissible",
      duration: 200 // 0.2초 후 자동으로 사라짐 (빠른 피드백)
    });
    this.dispatchEvent(event);
  }
}

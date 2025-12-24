use cardano/transaction.{OutputReference, Transaction}

pub type Datum {
  seller: ByteArray,
  status: Int,
}

pub type Redeemer {
  action: Int,
  buyer: ByteArray,
}

validator ticket_marketplace {
  spend(
    datum: Option<Datum>,
    redeemer: Redeemer,
    out_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(datum) = datum
    let action = redeemer.action
    let buyer = redeemer.buyer
    if action == 0 {
      // Buy action: ticket must be available (status 0), buyer not seller
      expect datum.status == 0
      expect buyer != datum.seller
      True
    } else if action == 1 {
      // Cancel action: only seller can cancel
      expect buyer == datum.seller
      True
    } else {
      fail
    }
  }

  else(_) {
    fail
  }
}
